import { Link, useNavigate } from "@tanstack/react-router";
import { CornerUpRight, Footprints, LoaderCircle, Plus, ShieldCheck, X } from "lucide-react";
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
import { distanceM, formatKm, LOCATIONS, placeByName, walkMinutes } from "@/lib/campus";
import { directionsUrl } from "@/lib/responder";
import type { LiveLocation } from "@/lib/use-live-location";
import { NeuSelect, placeOptions } from "@/components/shared/neu-select";
import { getFix, readLastFix } from "@/lib/gps";
import { cn } from "@/lib/utils";

/** After the deadline, the phone asks "Are you safe?" for this long before raising SOS. */
const CHECK_IN_GRACE_S = 30;
const DURATIONS = [5, 10, 15, 20, 30];
const PING_EVERY_MS = 30_000;

type Place = { name: string; lat: number; lng: number };

type WalkState = {
  walk: SafeWalk | null;
  /** Where to guide the student on the map: the active walk's place, or the one being picked. */
  guide: Place | null;
  /** The place picked in the form before the walk starts (location id). */
  preview: string | null;
  setPreview: (id: string | null) => void;
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
  const [preview, setPreview] = useState<string | null>(null);

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
      const started = await startWalk({ data: { destination, minutes, fix } });
      if (fix) rememberStart(started.id, fix);
      setWalk(started);
      setPreview(null);
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

  const guide = useMemo<Place | null>(() => {
    const place =
      walk?.status === "active"
        ? placeByName(walk.destination)
        : LOCATIONS.find((l) => l.id === preview);
    return place ? { name: place.name, lat: place.lat, lng: place.lng } : null;
  }, [walk, preview]);

  const value = useMemo(
    () => ({ walk, guide, preview, setPreview, remaining, busy, start, extend, finish }),
    [walk, guide, preview, remaining, busy, start, extend, finish],
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

/** Where a walk started, kept on this device so progress can be measured by distance. */
const START_KEY = (id: string) => `campussafe.walk-start.${id}`;
function rememberStart(id: string, fix: { lat: number; lng: number }) {
  try {
    localStorage.setItem(START_KEY(id), JSON.stringify({ lat: fix.lat, lng: fix.lng }));
  } catch {
    /* storage blocked: progress falls back to time */
  }
}
function readStart(id: string): { lat: number; lng: number } | null {
  try {
    const raw = localStorage.getItem(START_KEY(id));
    return raw ? (JSON.parse(raw) as { lat: number; lng: number }) : null;
  } catch {
    return null;
  }
}

function clock(at: string | number) {
  return new Date(at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
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
export function SafeWalkCard({
  className,
  location,
}: {
  className?: string;
  /** The home page's live location, used to measure progress toward the destination. */
  location?: LiveLocation;
}) {
  const { walk, guide, preview, setPreview, remaining, busy, start, extend, finish } =
    useSafeWalk();
  const [minutes, setMinutes] = useState(10);

  if (walk?.status === "active" && remaining != null) {
    return (
      <WalkProgress
        className={className}
        walk={walk}
        remaining={remaining}
        guide={guide}
        location={location}
        busy={busy}
        onSafe={() => void finish("completed")}
        onExtend={() => void extend(5)}
        onCancel={() => void finish("cancelled")}
      />
    );
  }

  const picked = LOCATIONS.find((l) => l.id === preview);
  return (
    <section className={cn("card p-4", className)} aria-labelledby="walk-title">
      <div className="flex items-center gap-3">
        <span className="neu-raised grid size-11 shrink-0 place-items-center rounded-2xl text-neon">
          <Footprints className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 id="walk-title" className="text-sm font-semibold">
            Walk with me
          </h2>
          <p className="text-xs text-muted">
            Walking alone? We&apos;ll guide you there and check on you. Miss the check-in and an SOS
            goes out.
          </p>
        </div>
      </div>
      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!picked) {
            toast("Where are you heading?");
            return;
          }
          void start(picked.name, minutes);
        }}
      >
        <NeuSelect
          value={preview ?? ""}
          onValueChange={(v) => setPreview(v || null)}
          options={placeOptions(LOCATIONS)}
          placeholder="Where to? Pick a campus place"
          aria-label="Destination"
        />
        {picked && (
          <p className="flex items-center gap-1.5 px-1 text-xs text-muted">
            <CornerUpRight className="size-3.5 text-neon" />
            {picked.name} is marked on the map above.
          </p>
        )}
        <div className="flex gap-1.5" role="radiogroup" aria-label="Time limit">
          {DURATIONS.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={minutes === m}
              onClick={() => setMinutes(m)}
              className={cn(
                "min-h-10 flex-1 rounded-xl text-xs font-semibold transition-[box-shadow,color]",
                minutes === m
                  ? "text-neon shadow-[var(--neu-inset-sm)]"
                  : "text-muted shadow-[var(--neu-raised-xs)] hover:text-fg hover:shadow-[var(--neu-raised-sm)]",
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
          Start walk · {minutes} min
        </button>
      </form>
    </section>
  );
}

/** Quadratic curve of the progress path, in the arc's 320 × 84 viewBox. */
const ARC = { x0: 6, y0: 72, cx: 160, cy: 4, x1: 314, y1: 72 };
function arcPoint(t: number) {
  const u = 1 - t;
  return {
    x: u * u * ARC.x0 + 2 * u * t * ARC.cx + t * t * ARC.x1,
    y: u * u * ARC.y0 + 2 * u * t * ARC.cy + t * t * ARC.y1,
  };
}

/**
 * Active walk, readable at a glance: from → to, a path with the walker on it,
 * how far is left and when to check in. Progress is measured by distance when
 * GPS is on, otherwise by the time limit.
 */
function WalkProgress({
  className,
  walk,
  remaining,
  guide,
  location,
  busy,
  onSafe,
  onExtend,
  onCancel,
}: {
  className?: string;
  walk: SafeWalk;
  remaining: number;
  guide: { name: string; lat: number; lng: number } | null;
  location?: LiveLocation;
  busy: boolean;
  onSafe: () => void;
  onExtend: () => void;
  onCancel: () => void;
}) {
  const total = Math.max(
    1,
    (new Date(walk.dueAt).getTime() - new Date(walk.startedAt).getTime()) / 1000,
  );
  const fix = location?.fix && !location.fix.approx ? location.fix : null;
  const startPt = readStart(walk.id);
  const left = guide && fix ? distanceM(fix, guide) : null;
  const span = guide && startPt ? distanceM(startPt, guide) : null;
  const byDistance = left != null && span != null && span > 25;
  const progress = Math.min(1, Math.max(0, byDistance ? 1 - left! / span! : 1 - remaining / total));
  const arrived = left != null && left < 25;
  const low = remaining <= 120;
  const dot = arcPoint(progress);

  return (
    <section className={cn("card p-2", className)} aria-label="Safe walk in progress">
      <div
        className={cn(
          "relative overflow-hidden rounded-[20px] px-5 pb-4 pt-5 text-white",
          "bg-[radial-gradient(120%_80%_at_50%_120%,rgb(77_141_255/0.35),transparent_60%),linear-gradient(165deg,#0d1730,#132650_55%,#183166)]",
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">From</p>
            <p className="mt-1 font-display text-2xl font-semibold leading-none">You</p>
            <p className="mt-1.5 text-sm text-white/75">{clock(walk.startedAt)}</p>
          </div>
          <div className="min-w-0 text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">To</p>
            <p className="mt-1 truncate font-display text-2xl font-semibold leading-none">
              {walk.destination}
            </p>
            <p className="mt-1.5 text-sm text-white/75">by {clock(walk.dueAt)}</p>
          </div>
        </div>

        <div className="relative mt-2 aspect-[320/84] w-full">
          <svg viewBox="0 0 320 84" className="absolute inset-0 size-full" aria-hidden="true">
            <defs>
              <linearGradient id={`walk-arc-${walk.id}`} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                <stop offset="100%" stopColor={low ? "#f0b75e" : "#6f9bff"} />
              </linearGradient>
            </defs>
            <path
              d={`M ${ARC.x0} ${ARC.y0} Q ${ARC.cx} ${ARC.cy} ${ARC.x1} ${ARC.y1}`}
              fill="none"
              stroke="rgb(255 255 255 / 0.16)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d={`M ${ARC.x0} ${ARC.y0} Q ${ARC.cx} ${ARC.cy} ${ARC.x1} ${ARC.y1}`}
              fill="none"
              stroke={`url(#walk-arc-${walk.id})`}
              strokeWidth="3.5"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={`${progress * 100} 100`}
              className="transition-[stroke-dasharray] duration-700 ease-[var(--ease-smooth-out)]"
            />
            <circle
              cx={ARC.x1}
              cy={ARC.y1}
              r="4"
              fill={arrived ? "#5fd3a5" : "rgb(255 255 255 / 0.5)"}
            />
          </svg>
          <span
            className="absolute grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#2d6ade] shadow-[0_0_0_6px_rgb(77_141_255/0.25),0_0_24px_6px_rgb(77_141_255/0.45)] transition-[left,top] duration-700 ease-[var(--ease-smooth-out)]"
            style={{ left: `${(dot.x / 320) * 100}%`, top: `${(dot.y / 84) * 100}%` }}
          >
            <Footprints className="size-4" />
          </span>
        </div>

        <div className="mt-1 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">
              Check in
            </p>
            <p
              className={cn(
                "font-display text-xl font-semibold tabular-nums",
                low && "text-[#f0b75e]",
              )}
              role="timer"
              aria-label={`${formatTimer(remaining)} left to check in`}
            >
              {formatTimer(remaining)}
            </p>
          </div>
          <p className="text-right text-sm font-semibold text-[#9cbcff]">
            {arrived
              ? "You've arrived"
              : left != null
                ? `Arriving in ~${walkMinutes(left)} min`
                : `${Math.round(progress * 100)}% of your time used`}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-5 gap-y-1.5 px-3 pb-1 pt-4 text-sm">
        <dt className="text-muted">Distance</dt>
        <dd className="font-medium">
          {left != null ? `${formatKm(left)} to go` : "Turn on location to track"}
        </dd>
        <dt className="text-muted">Check in by</dt>
        <dd className="font-medium">{clock(walk.dueAt)}</dd>
        <dt className="text-muted">If you don&apos;t</dt>
        <dd className="font-medium">Campus command gets an SOS</dd>
      </dl>

      <div className="mt-3 grid grid-cols-[1fr_auto_auto_auto] gap-2 px-2 pb-2">
        <button
          type="button"
          disabled={busy}
          onClick={onSafe}
          className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-ok text-sm font-bold text-ink shadow-[var(--neu-raised-xs)] disabled:opacity-60"
        >
          <ShieldCheck className="size-4" /> I&apos;m safe
        </button>
        {guide && (
          <a
            href={directionsUrl(guide.lat, guide.lng)}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost px-3 text-neon"
            aria-label={`Walking directions to ${guide.name}`}
          >
            <CornerUpRight className="size-4" />
          </a>
        )}
        <button type="button" disabled={busy} onClick={onExtend} className="btn-ghost px-3">
          <Plus className="size-4" /> 5 min
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="btn-ghost px-3 text-muted"
          aria-label="Cancel walk"
        >
          <X className="size-4" />
        </button>
      </div>
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
