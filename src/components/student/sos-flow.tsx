import { useNavigate } from "@tanstack/react-router";
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
import { SosButton } from "@/components/sos-button";
import { clearPendingSos, getFix, readPendingSos, writePendingSos } from "@/lib/gps";
import { createSos } from "@/lib/server/sos";
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

/**
 * The student SOS flow, shared by every SOS button in the student shell (phone
 * tab bar, desktop rail, home card): countdown overlay → send with the best GPS
 * fix → open the live alert. If sending fails (offline, server hiccup) the alert
 * is stored and retried until it lands, including after a reload.
 */
export function SosFlowProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [overlay, setOverlay] = useState<"countdown" | "sending" | null>(null);
  const [count, setCount] = useState(5);
  const [retrying, setRetrying] = useState(false);
  const [buttonKey, setButtonKey] = useState(0);
  const liveLocation = useRef<LiveLocation | null>(null);

  const flushPending = useCallback(async () => {
    const pending = readPendingSos();
    if (!pending) return;
    setRetrying(true);
    let alertId: string;
    try {
      const alert = await createSos({
        data: { lat: pending.lat, lng: pending.lng, acc: pending.acc, approx: pending.approx },
      });
      alertId = alert.id;
    } catch {
      window.setTimeout(() => void flushPending(), 4000);
      return;
    }
    clearPendingSos();
    setRetrying(false);
    await navigate({ to: "/sos/$id", params: { id: alertId } }).catch(() => {});
  }, [navigate]);

  useEffect(() => {
    if (readPendingSos()) void flushPending();
  }, [flushPending]);

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
    let alertId: string;
    try {
      const alert = await createSos({
        data: { lat: current.lat, lng: current.lng, acc: current.acc, approx: current.approx },
      });
      alertId = alert.id;
    } catch {
      // Offline or server hiccup: keep the alert and keep retrying until it lands.
      writePendingSos({ ...current, ts: Date.now() });
      setRetrying(true);
      setOverlay(null);
      setButtonKey((k) => k + 1);
      window.setTimeout(() => void flushPending(), 4000);
      return;
    }
    clearPendingSos();
    // Never re-send on a navigation error: the alert already exists.
    await navigate({ to: "/sos/$id", params: { id: alertId } }).catch(() => {});
    // The shell outlives the page, so clear the overlay once the alert view is up.
    setOverlay(null);
    setButtonKey((k) => k + 1);
  }, [navigate, flushPending]);

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
    () => ({ arm, retrying, buttonKey, shareLiveLocation }),
    [arm, retrying, buttonKey, shareLiveLocation],
  );

  return (
    <SosFlowContext.Provider value={value}>
      {children}

      {retrying && !overlay && (
        <p
          role="status"
          className="fixed inset-x-4 bottom-[calc(6.5rem+var(--safe-bottom))] z-40 mx-auto max-w-sm rounded-xl bg-sos px-4 py-2.5 text-center text-sm font-semibold text-white shadow-lg md:bottom-6"
        >
          SOS not sent yet — retrying automatically…
        </p>
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
