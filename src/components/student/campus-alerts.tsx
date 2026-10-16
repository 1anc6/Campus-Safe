import { Check, Info, Megaphone, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ackCampusAlert, getMyCampusAlerts, type CampusAlert } from "@/backend/functions/alerts";
import { cn, formatClock } from "@/lib/utils";

const POLL_MS = 30_000;

const LEVEL = {
  critical: {
    icon: TriangleAlert,
    ring: "ring-sos/40",
    chip: "bg-sos text-white",
    tint: "bg-sos/10",
    label: "Urgent",
  },
  warning: {
    icon: Megaphone,
    ring: "ring-warn/40",
    chip: "bg-warn text-ink",
    tint: "bg-warn/10",
    label: "Warning",
  },
  info: {
    icon: Info,
    ring: "ring-[var(--color-neon)]/30",
    chip: "bg-accent text-on-accent",
    tint: "bg-accent/10",
    label: "Notice",
  },
} as const;

/**
 * Campus-wide broadcasts from command, shown at the top of every student page
 * until the student taps "Got it".
 */
export function CampusAlertBanners() {
  const [alerts, setAlerts] = useState<CampusAlert[]>([]);
  const seenIds = useRef(new Set<string>());

  const load = useCallback(async () => {
    if (document.visibilityState === "hidden") return;
    try {
      const next = await getMyCampusAlerts();
      // Buzz once for a newly arrived urgent alert.
      if (next.some((a) => a.level === "critical" && !seenIds.current.has(a.id))) {
        try {
          navigator.vibrate?.([120, 80, 120]);
        } catch {
          /* vibration unsupported */
        }
      }
      next.forEach((a) => seenIds.current.add(a.id));
      setAlerts(next);
    } catch {
      /* keep what we have */
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), POLL_MS);
    document.addEventListener("visibilitychange", load);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", load);
    };
  }, [load]);

  if (alerts.length === 0) return null;

  return (
    <div className="mb-4 space-y-2" aria-live="polite">
      {alerts.map((a) => {
        const L = LEVEL[a.level];
        return (
          <section
            key={a.id}
            role={a.level === "critical" ? "alert" : "status"}
            className={cn(
              "glass flex gap-3 p-3.5 ring-1 shadow-[var(--neu-raised-sm)] animate-in fade-in-0 slide-in-from-top-2",
              L.ring,
            )}
          >
            <span className={cn("grid size-10 shrink-0 place-items-center rounded-2xl", L.tint)}>
              <L.icon
                className={cn(
                  "size-5",
                  a.level === "critical"
                    ? "text-sos"
                    : a.level === "warning"
                      ? "text-warn"
                      : "text-neon",
                )}
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    L.chip,
                  )}
                >
                  {L.label}
                </span>
                <span className="text-[11px] text-dim">
                  Campus command · {formatClock(a.createdAt)}
                </span>
              </p>
              <p className="mt-1 font-semibold">{a.title}</p>
              <p className="mt-0.5 whitespace-pre-line text-sm text-muted">{a.body}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setAlerts((list) => list.filter((x) => x.id !== a.id));
                void ackCampusAlert({ data: { id: a.id } }).catch(() => void load());
              }}
              className="btn-ghost h-10 shrink-0 self-start px-3 text-xs"
            >
              <Check className="size-4" /> Got it
            </button>
          </section>
        );
      })}
    </div>
  );
}
