import { Link, useNavigate } from "@tanstack/react-router";
import { Footprints, LoaderCircle, MapPin, Plus, ShieldCheck, X } from "lucide-react";
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
import {
  endWalk,
  escalateMyWalk,
  extendWalk,
  getMyWalk,
  pingWalk,
  startWalk,
  type SafeWalk,
} from "@/backend/functions/walks";
import { LOCATIONS } from "@/lib/campus";
import { getFix, readLastFix } from "@/lib/gps";
import { cn } from "@/lib/utils";

/** After the deadline, the phone asks "Are you safe?" for this long before raising SOS. */
const CHECK_IN_GRACE_S = 30;
const DURATIONS = [5, 10, 15, 20, 30];
const PING_EVERY_MS = 30_000;

type WalkState = {
  walk: SafeWalk | null;
  /** Seconds until the deadline (negative once overdue). */
  remaining: number | null;
  busy: boolean;
  start: (destination: string, minutes: number) => Promise<void>;
  extend: (minutes: number) => Promise<void>;
  finish: (outcome: "completed" | "cancelled") => Promise<void>;
};

const WalkContext = createContext<WalkState | null>(null);

export function useSafeWalk(): WalkState {
  const ctx = useContext(WalkContext);
  if (!ctx) throw new Error("useSafeWalk must be used inside <SafeWalkProvider>");
  return ctx;
}

function lastFix() {
  try {
    const f = readLastFix();
    return f && !f.approx ? { lat: f.lat, lng: f.lng, acc: f.acc } : null;
  } catch {
    return null;
  }
}

/**
 * "Walk with me" — a watchdog timer. Lives in the student shell so the
 * countdown, the floating pill and the "Are you safe?" check-in work on every
 * student page.
 */
export function SafeWalkProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [walk, setWalk] = useState<SafeWalk | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const escalatedFor = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setWalk(await getMyWalk());
    } catch {
      /* keep the last known state */
    }
  }, []);

  // Load on start and re-sync every 30 s (another device may have ended it).
  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(t);
  }, [refresh]);

  const active = walk?.status === "active";

  // Tick every second while a walk is active.
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [active]);

  // Keep the walk's last known position fresh, in case it escalates.
  useEffect(() => {
    if (!active || !walk) return;
    const send = () =>
      void getFix().then((f) => {
        if (!f.approx) {
          void pingWalk({
            data: { id: walk.id, fix: { lat: f.lat, lng: f.lng, acc: f.acc } },
          }).catch(() => {});
        }
      });
    send();
    const t = window.setInterval(send, PING_EVERY_MS);
    return () => window.clearInterval(t);
  }, [active, walk]);

  const remaining =
    active && walk ? Math.round((new Date(walk.dueAt).getTime() - now) / 1000) : null;

  // The check-in countdown ran out: raise the SOS from the phone.
  useEffect(() => {
    if (!active || !walk || remaining == null) return;
    if (remaining > -CHECK_IN_GRACE_S || escalatedFor.current === walk.id) return;
    escalatedFor.current = walk.id;
    setEscalating(true);
    void escalateMyWalk({ data: { id: walk.id, fix: lastFix() } })
      .then(async ({ sosId }) => {
        await refresh();
        if (sosId) await navigate({ to: "/sos/$id", params: { id: sosId } });
      })
      .catch(() => {
        // Server watchdog will still escalate it; keep the student informed.
        toast.error("Couldn't reach the server — campus command will be alerted automatically.");
        escalatedFor.current = null;
      })
      .finally(() => setEscalating(false));
  }, [active, walk, remaining, navigate, refresh]);

  // A walk that escalated (here or by the server watchdog) points at its SOS.
  useEffect(() => {
    if (walk?.status === "escalated" && walk.sosId && escalatedFor.current !== walk.id) {
      escalatedFor.current = walk.id;
      toast.error("Your safe walk wasn't checked in — an SOS was raised.", {
        action: {
          label: "View",
          onClick: () => void navigate({ to: "/sos/$id", params: { id: walk.sosId! } }),
        },
        duration: 15_000,
      });
    }
  }, [walk, navigate]);

  const start = useCallback(async (destination: string, minutes: number) => {
    setBusy(true);
    try {
      const fix = lastFix();
      setWalk(await startWalk({ data: { destination, minutes, fix } }));
      setNow(Date.now());
      toast.success(`Walk started — check in within ${minutes} min`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't start the walk");
    } finally {
      setBusy(false);
    }
  }, []);

  const extend = useCallback(
    async (minutes: number) => {
      if (!walk) return;
      setBusy(true);
      try {
        setWalk(await extendWalk({ data: { id: walk.id, minutes } }));
        setNow(Date.now());
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't add time");
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [walk, refresh],
  );

  const finish = useCallback(
    async (outcome: "completed" | "cancelled") => {
      if (!walk) return;
      setBusy(true);
      try {
        await endWalk({ data: { id: walk.id, outcome } });
        setWalk(null);
        toast.success(outcome === "completed" ? "Glad you're safe!" : "Walk cancelled");
      } catch {
        toast.error("Couldn't reach the server — try again");
      } finally {
        setBusy(false);
      }
    },
    [walk],
  );

  const value = useMemo(
    () => ({ walk, remaining, busy, start, extend, finish }),
    [walk, remaining, busy, start, extend, finish],
  );

  const overdue = active && remaining != null && remaining <= 0;

  return (
    <WalkContext.Provider value={value}>
      {children}
      {overdue && walk && (
        <CheckInOverlay
          walk={walk}
          secondsLeft={Math.max(0, CHECK_IN_GRACE_S + (remaining ?? 0))}
          escalating={escalating}
          busy={busy}
          onSafe={() => void finish("completed")}
          onExtend={() => void extend(5)}
        />
      )}
    </WalkContext.Provider>
  );
}

function formatTimer(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/** "Are you safe?" — the last chance before an SOS is raised. */
function CheckInOverlay({
  walk,
  secondsLeft,
  escalating,
  busy,
  onSafe,
  onExtend,
}: {
  walk: SafeWalk;
  secondsLeft: number;
  escalating: boolean;
  busy: boolean;
  onSafe: () => void;
  onExtend: () => void;
}) {
  useEffect(() => {
    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {
      /* vibration unsupported */
    }
  }, []);
  return (
    <div
      className="fixed inset-0 z-[1000] grid place-items-center bg-bg/80 px-6 pb-safe pt-safe backdrop-blur-xl"
      role="alertdialog"
      aria-modal="true"
      aria-label="Are you safe?"
    >
      <div className="glass flex w-full max-w-sm flex-col items-center p-6 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-warn/15 text-warn">
          <Footprints className="size-7" />
        </span>
        <h2 className="mt-4 font-display text-2xl font-semibold">Are you safe?</h2>
        <p className="mt-1 text-sm text-muted">
          Your walk to <span className="font-medium text-fg">{walk.destination}</span> is over time.
        </p>
        {escalating ? (
          <p className="mt-6 flex items-center gap-2 text-sm font-semibold text-sos">
            <LoaderCircle className="size-4 animate-spin" /> Alerting campus command…
          </p>
        ) : (
          <>
            <p
              className="mt-5 font-display text-6xl font-bold tabular-nums text-sos"
              aria-live="assertive"
            >
              {secondsLeft}
            </p>
            <p className="text-xs text-muted">seconds until an SOS is sent automatically</p>
          </>
        )}
        <button
          type="button"
          autoFocus
          disabled={busy || escalating}
          onClick={onSafe}
          className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-ok text-base font-bold text-ink disabled:opacity-60"
        >
          <ShieldCheck className="size-5" /> I&apos;M SAFE
        </button>
        <button
          type="button"
          disabled={busy || escalating}
          onClick={onExtend}
          className="btn-ghost mt-2 w-full disabled:opacity-60"
        >
          <Plus className="size-4" /> I need 5 more minutes
        </button>
      </div>
    </div>
  );
}

/** Home-page card: start a walk, or follow the active one. */
export function SafeWalkCard({ className }: { className?: string }) {
  const { walk, remaining, busy, start, extend, finish } = useSafeWalk();
  const [destination, setDestination] = useState("");
  const [minutes, setMinutes] = useState(10);

  if (walk?.status === "active" && remaining != null) {
    const total = Math.max(
      1,
      (new Date(walk.dueAt).getTime() - new Date(walk.startedAt).getTime()) / 1000,
    );
    const pct = Math.min(100, Math.max(0, (remaining / total) * 100));
    const low = remaining <= 120;
    return (
      <section className={cn("card p-4", className)} aria-label="Safe walk in progress">
        <div className="flex items-center gap-4">
          <div
            className="relative grid size-20 shrink-0 place-items-center rounded-full"
            style={{
              background: `conic-gradient(${low ? "var(--color-warn)" : "var(--color-accent)"} ${pct}%, var(--color-line) 0)`,
            }}
          >
            <div className="grid size-[68px] place-items-center rounded-full bg-[var(--glass-strong)] backdrop-blur">
              <span
                className={cn(
                  "font-display text-lg font-semibold tabular-nums",
                  low && "text-warn",
                )}
              >
                {formatTimer(remaining)}
              </span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-neon">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-accent" />
              </span>
              Walk with me · active
            </p>
            <p className="mt-1 flex items-center gap-1.5 truncate font-medium">
              <MapPin className="size-4 shrink-0 text-muted" /> {walk.destination}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Check in before the timer ends, or an SOS is raised for you.
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-[1fr_auto_auto] gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void finish("completed")}
            className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-ok text-sm font-bold text-ink disabled:opacity-60"
          >
            <ShieldCheck className="size-4" /> I&apos;m safe
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void extend(5)}
            className="btn-ghost px-3"
          >
            <Plus className="size-4" /> 5 min
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void finish("cancelled")}
            className="btn-ghost px-3 text-muted"
            aria-label="Cancel walk"
          >
            <X className="size-4" />
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={cn("card p-4", className)} aria-labelledby="walk-title">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent/15 text-neon">
          <Footprints className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 id="walk-title" className="text-sm font-semibold">
            Walk with me
          </h2>
          <p className="text-xs text-muted">
            Walking alone? We&apos;ll check on you — miss the check-in and an SOS goes out.
          </p>
        </div>
      </div>
      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (destination.trim().length < 2) {
            toast("Where are you heading?");
            return;
          }
          void start(destination.trim(), minutes);
        }}
      >
        <input
          className="input"
          list="walk-destinations"
          placeholder="Where to? e.g. Boys Hostel"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          aria-label="Destination"
        />
        <datalist id="walk-destinations">
          {LOCATIONS.map((l) => (
            <option key={l.id} value={l.name} />
          ))}
        </datalist>
        <div className="flex gap-1.5" role="radiogroup" aria-label="Time limit">
          {DURATIONS.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={minutes === m}
              onClick={() => setMinutes(m)}
              className={cn(
                "min-h-10 flex-1 rounded-xl text-xs font-semibold ring-1 transition-colors",
                minutes === m
                  ? "bg-accent/15 text-neon ring-[var(--color-neon)]/40"
                  : "bg-panel-2 text-muted ring-line hover:text-fg",
              )}
            >
              {m}m
            </button>
          ))}
        </div>
        <button type="submit" disabled={busy} className="btn-neon w-full">
          {busy ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Footprints className="size-4" />
          )}
          START WALK · {minutes} MIN
        </button>
      </form>
    </section>
  );
}

/** Floating reminder on other student pages while a walk is active. */
export function SafeWalkPill({ hidden }: { hidden?: boolean }) {
  const { walk, remaining, busy, finish } = useSafeWalk();
  if (hidden || walk?.status !== "active" || remaining == null || remaining <= 0) return null;
  const low = remaining <= 120;
  return (
    <div className="fixed inset-x-3 bottom-[calc(6.25rem+var(--safe-bottom))] z-30 mx-auto flex max-w-sm justify-center md:bottom-6 md:left-auto md:right-6 md:mx-0">
      <div className="glass-bar flex items-center gap-2 rounded-full py-1.5 pl-3 pr-1.5 text-xs">
        <Footprints className={cn("size-4", low ? "text-warn" : "text-neon")} />
        <Link to="/" className="min-w-0 truncate">
          <span className="font-semibold tabular-nums">{formatTimer(remaining)}</span>
          <span className="text-muted"> · to {walk.destination}</span>
        </Link>
        <button
          type="button"
          disabled={busy}
          onClick={() => void finish("completed")}
          className="ml-1 rounded-full bg-ok px-3 py-1.5 text-[11px] font-bold text-ink"
        >
          I&apos;m safe
        </button>
      </div>
    </div>
  );
}
