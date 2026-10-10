import { useNavigate } from "@tanstack/react-router";
import { LoaderCircle, Phone, RotateCw, TriangleAlert, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { SosButton } from "@/components/shared/sos-button";
import { createSos } from "@/backend/functions/sos";
import { campusProximity, formatKm, SECURITY_LINE } from "@/lib/campus";
import { clearPendingSos, getFix, readLastFix, readPendingSos, writePendingSos } from "@/lib/gps";
import type { GpsFix } from "@/lib/types";
import type { LiveLocation } from "@/lib/use-live-location";

type SosFlow = {
  /** Start the 5-second countdown (called once a hold completes). */
  arm: () => void;
  retrying: boolean;
  /** Bumped after a cancelled countdown; used as a `key` to re-arm every SOS button. */
  buttonKey: number;
  /** Pages already tracking GPS (the home map) hand over their live fix for a faster send. */
  shareLiveLocation: (location: LiveLocation | null) => void;
};

const SosFlowContext = createContext<SosFlow | null>(null);

export function useSosFlow(): SosFlow {
  const ctx = useContext(SosFlowContext);
  if (!ctx) throw new Error("useSosFlow must be used inside <SosFlowProvider>");
  return ctx;
}

/** Retry delays (exponential backoff, capped): 4 s, 8 s, 15 s, then every 30 s. */
const BACKOFF_MS = [4000, 8000, 15000, 30000];
/** An undelivered SOS older than this is not sent silently on reopening the app. */
const STALE_PENDING_MS = 30 * 60_000;

type Delivery = {
  /** offline: no network · rejected: the server refused it · stale: old, needs a decision */
  problem: "offline" | "rejected" | "stale";
  attempts: number;
  /** Server's reason when rejected. */
  detail?: string;
  /** When the next automatic retry happens (ms epoch), if one is scheduled. */
  nextAt?: number;
  ageMin?: number;
};

const SECURITY_TEL = `tel:${SECURITY_LINE.phone.replaceAll(" ", "")}`;

/** A short, human reason from a server error (validation errors arrive as JSON). */
function errorReason(err: unknown): string | undefined {
  const raw = err instanceof Error ? err.message.trim() : "";
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && typeof parsed[0]?.message === "string") {
      const path = Array.isArray(parsed[0].path) ? parsed[0].path.join(".") : "";
      return `${path ? `${path}: ` : ""}${parsed[0].message}`;
    }
  } catch {
    /* plain-text message */
  }
  return raw.length > 120 ? `${raw.slice(0, 117)}…` : raw;
}

function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  // fetch() rejects with a TypeError when the request never reached the server.
  return err instanceof TypeError;
}

/**
 * The student SOS flow, shared by every SOS button in the student shell (phone
 * tab bar, desktop rail, home card): countdown overlay → send with the best GPS
 * fix → open the live alert.
 *
 * If sending fails the alert is stored on the phone and retried with backoff
 * until it lands (store-and-forward), including after a reload — while showing
 * the student why, with buttons to call security, retry now, or cancel.
 */
export function SosFlowProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [overlay, setOverlay] = useState<"countdown" | "sending" | null>(null);
  const [count, setCount] = useState(5);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [buttonKey, setButtonKey] = useState(0);
  const liveLocation = useRef<LiveLocation | null>(null);
  /** The single retry timer — never more than one retry loop at a time. */
  const retryTimer = useRef<number | undefined>(undefined);
  const attemptsRef = useRef(0);
  const inFlight = useRef(false);

  const stopRetrying = useCallback(() => {
    window.clearTimeout(retryTimer.current);
    retryTimer.current = undefined;
  }, []);

  const deliverPending = useCallback(async () => {
    const pending = readPendingSos();
    if (!pending || inFlight.current) return;
    stopRetrying();
    inFlight.current = true;
    let alertId: string;
    try {
      const alert = await createSos({
        data: { lat: pending.lat, lng: pending.lng, acc: pending.acc, approx: pending.approx },
      });
      alertId = alert.id;
    } catch (err) {
      inFlight.current = false;
      attemptsRef.current += 1;
      const delay = BACKOFF_MS[Math.min(attemptsRef.current - 1, BACKOFF_MS.length - 1)];
      setDelivery({
        problem: isNetworkError(err) ? "offline" : "rejected",
        attempts: attemptsRef.current,
        detail: isNetworkError(err) ? undefined : errorReason(err),
        nextAt: Date.now() + delay,
      });
      retryTimer.current = window.setTimeout(() => void deliverPending(), delay);
      return;
    }
    inFlight.current = false;
    attemptsRef.current = 0;
    clearPendingSos();
    setDelivery(null);
    toast.success("SOS delivered to campus command");
    // Never re-send on a navigation error: the alert already exists.
    await navigate({ to: "/sos/$id", params: { id: alertId } }).catch(() => {});
  }, [navigate, stopRetrying]);

  // On app start: resume an undelivered SOS — unless it's old, then ask first.
  useEffect(() => {
    const pending = readPendingSos();
    if (!pending) return;
    const age = Date.now() - pending.ts;
    if (age > STALE_PENDING_MS) {
      setDelivery({ problem: "stale", attempts: 0, ageMin: Math.round(age / 60_000) });
      return;
    }
    void deliverPending();
    return stopRetrying;
  }, [deliverPending, stopRetrying]);

  // Retry immediately when the phone comes back online.
  useEffect(() => {
    const onOnline = () => {
      if (readPendingSos() && delivery?.problem !== "stale") void deliverPending();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [deliverPending, delivery?.problem]);

  const cancelPending = useCallback(() => {
    stopRetrying();
    clearPendingSos();
    attemptsRef.current = 0;
    setDelivery(null);
    toast("SOS cancelled — it was not sent");
  }, [stopRetrying]);

  const send = useCallback(async () => {
    setOverlay("sending");
    try {
      await navigator.wakeLock?.request("screen");
    } catch {
      /* wake lock unsupported — continue */
    }
    // Use the live fix the map is already tracking; fall back to a one-off read.
    const loc = liveLocation.current;
    const current: GpsFix =
      loc?.status === "live" && loc.fix && !loc.fix.approx ? loc.fix : await getFix();
    // Store first, then send: if anything goes wrong the alert is not lost.
    writePendingSos({ ...current, ts: Date.now() });
    attemptsRef.current = 0;
    setDelivery(null);
    await deliverPending();
    // Keep "Sending SOS" up through the first attempt; then either the alert
    // screen is open, or the delivery card explains what's happening.
    setOverlay(null);
    setButtonKey((k) => k + 1);
  }, [deliverPending]);

  useEffect(() => {
    if (overlay !== "countdown") return;
    if (count <= 0) {
      void send();
      return;
    }
    const t = window.setTimeout(() => setCount((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [overlay, count, send]);

  const arm = useCallback(() => {
    setCount(5);
    setOverlay("countdown");
  }, []);

  const shareLiveLocation = useCallback((location: LiveLocation | null) => {
    liveLocation.current = location;
  }, []);

  const value = useMemo(
    () => ({ arm, retrying: delivery !== null, buttonKey, shareLiveLocation }),
    [arm, delivery, buttonKey, shareLiveLocation],
  );

  // Where the student is relative to campus, for the countdown warning.
  const knownFix = liveLocation.current?.fix ?? readLastFixSafe();
  const proximity = overlay === "countdown" && knownFix ? campusProximity(knownFix) : null;

  return (
    <SosFlowContext.Provider value={value}>
      {children}

      {delivery && !overlay && (
        <DeliveryCard
          delivery={delivery}
          onRetry={() => {
            if (delivery.problem === "stale") attemptsRef.current = 0;
            void deliverPending();
          }}
          onCancel={cancelPending}
        />
      )}

      {overlay && (
        <div
          className="fixed inset-0 z-[1000] grid place-items-center bg-bg/95 px-6 pb-safe pt-safe backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-label={overlay === "countdown" ? "SOS countdown" : "Sending SOS"}
        >
          {overlay === "countdown" ? (
            <div className="flex w-full max-w-xs flex-col items-center text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sos">
                Sending SOS in
              </p>
              <p
                className="mt-2 font-display text-8xl font-bold tabular-nums leading-none"
                aria-live="assertive"
              >
                {count}
              </p>
              <p className="mt-3 text-sm text-muted">Campus command will see your location.</p>
              {proximity?.zone === "far" && (
                <div className="mt-5 w-full rounded-xl bg-sos/10 p-3 text-left text-xs ring-1 ring-sos/30">
                  <p className="font-semibold text-sos">
                    Area too far — you&apos;re {formatKm(proximity.distance)} from campus
                  </p>
                  <p className="mt-1 text-muted">
                    Campus security can&apos;t reach you quickly. Your SOS will still be sent — for
                    immediate help also call <span className="font-semibold text-fg">112</span>.
                  </p>
                </div>
              )}
              <button
                type="button"
                autoFocus
                onClick={() => {
                  setOverlay(null);
                  setButtonKey((k) => k + 1);
                }}
                className="mt-8 min-h-14 w-full rounded-xl bg-fg text-base font-bold text-panel"
              >
                CANCEL
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center">
              <span className="size-16 animate-pulse rounded-full bg-sos shadow-[0_0_40px_var(--sos-glow)]" />
              <p className="mt-6 font-display text-2xl font-semibold">Sending SOS</p>
              <p className="mt-2 text-sm text-muted">Locking your location with campus command.</p>
            </div>
          )}
        </div>
      )}
    </SosFlowContext.Provider>
  );
}

function readLastFixSafe(): GpsFix | null {
  try {
    return readLastFix();
  } catch {
    return null;
  }
}

/** Status card for an SOS that hasn't reached the server yet. */
function DeliveryCard({
  delivery,
  onRetry,
  onCancel,
}: {
  delivery: Delivery;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const secs = delivery.nextAt ? Math.max(0, Math.ceil((delivery.nextAt - now) / 1000)) : null;

  const title =
    delivery.problem === "stale"
      ? `An SOS from ${delivery.ageMin} min ago was never delivered`
      : "SOS not delivered yet";
  const body =
    delivery.problem === "stale"
      ? "Send it now only if you still need help."
      : delivery.problem === "offline"
        ? "No internet connection. It will send automatically as soon as you're back online."
        : `The server didn't accept it${delivery.detail ? ` (${delivery.detail})` : ""}. Retrying automatically.`;

  return (
    <div
      role="alert"
      className="fixed inset-x-3 bottom-[calc(6.75rem+var(--safe-bottom))] z-40 mx-auto max-w-md overflow-hidden rounded-2xl bg-chrome shadow-2xl ring-1 ring-sos/40 md:bottom-6"
    >
      <div className="flex gap-3 bg-sos/10 p-3">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-sos" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-sos">{title}</p>
          <p className="mt-0.5 text-xs text-muted">{body}</p>
          {delivery.problem !== "stale" && (
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-dim">
              <LoaderCircle className="size-3 animate-spin" />
              Attempt {delivery.attempts}
              {secs != null && secs > 0 ? ` · next try in ${secs}s` : " · trying…"}
            </p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-px border-t border-line bg-line text-xs font-semibold">
        <a
          href={SECURITY_TEL}
          className="flex min-h-12 items-center justify-center gap-1.5 bg-chrome text-sos hover:bg-panel"
        >
          <Phone className="size-4" /> Call security
        </a>
        <button
          type="button"
          onClick={onRetry}
          className="flex min-h-12 items-center justify-center gap-1.5 bg-chrome text-fg hover:bg-panel"
        >
          <RotateCw className="size-4" /> {delivery.problem === "stale" ? "Send now" : "Retry now"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex min-h-12 items-center justify-center gap-1.5 bg-chrome text-muted hover:bg-panel"
        >
          <X className="size-4" /> Cancel SOS
        </button>
      </div>
    </div>
  );
}

/** An SOS hold button wired to the shared flow. */
export function SosTrigger({
  size = "lg",
  className,
}: {
  size?: "lg" | "md" | "sm";
  className?: string;
}) {
  const { arm, buttonKey } = useSosFlow();
  return (
    <SosButton
      key={buttonKey}
      size={size}
      className={className}
      onArmed={arm}
      onReleasedEarly={() =>
        toast("Hold SOS for 2 seconds to send an alert", { id: "sos-hold-hint" })
      }
    />
  );
}
