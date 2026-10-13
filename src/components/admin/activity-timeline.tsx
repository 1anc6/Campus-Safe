import { Link } from "@tanstack/react-router";
import { CheckCircle2, EyeOff, FileText, Megaphone, Radio } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { ActivityEvent } from "@/backend/functions/admin";
import { cn } from "@/lib/utils";

/**
 * Live activity feed for the command dashboard: updates grouped by day, newest
 * first, a connector line that draws down the feed, and new updates sliding in
 * at the top. Adapted from the 21st.dev "Timeline" component (kuratlielia), with
 * CSS animations instead of `motion` and CampusSafe's tokens. Arrow keys move
 * between rows; new updates are announced to screen readers.
 */

const HOUR = 3_600_000;
const TIME_ZONE = "Asia/Kolkata";

const ICONS = {
  sos: Radio,
  incident: FileText,
  anonymous: EyeOff,
  broadcast: Megaphone,
} as const;

function dayKey(time: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(time));
}

function relative(time: number, now: number) {
  const minutes = Math.max(0, Math.floor((now - time) / 60_000));
  if (minutes < 1) return { short: "Now", long: "just now" };
  if (minutes < 60) return { short: `${minutes}m`, long: `${minutes} min ago` };
  const hours = Math.floor(minutes / 60);
  return { short: `${hours}h`, long: `${hours} h ago` };
}

const clockFmt = new Intl.DateTimeFormat("en-IN", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});
const fullFmt = new Intl.DateTimeFormat("en-IN", {
  weekday: "long",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});
const dayFmt = new Intl.DateTimeFormat("en-IN", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: TIME_ZONE,
});

export function ActivityTimeline({
  events,
  now,
  className,
}: {
  events: ActivityEvent[] | null;
  now: number;
  className?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  // Rows that arrive after the first load slide in; everything else just draws in.
  const known = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [announcement, setAnnouncement] = useState("");
  const [more, setMore] = useState(false);

  useEffect(() => {
    if (!events) return;
    if (!known.current) {
      known.current = new Set(events.map((e) => e.id));
      return;
    }
    const added = events.filter((e) => !known.current!.has(e.id));
    if (!added.length) return;
    added.forEach((e) => known.current!.add(e.id));
    setFresh((prev) => new Set([...prev, ...added.map((e) => e.id)]));
    setAnnouncement(
      `New update: ${added.map((e) => [e.actor, e.title].filter(Boolean).join(" ")).join(". ")}`,
    );
    // Bring new updates into view if the feed was scrolled down.
    scroller.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [events]);

  // Feather the bottom edge while more updates wait below.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () => setMore(el.scrollHeight - el.clientHeight - el.scrollTop > 2);
    update();
    el.addEventListener("scroll", update, { passive: true });
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      obs.disconnect();
    };
  }, [events]);

  const groups = useMemo(() => {
    if (!events) return [];
    const today = dayKey(now);
    const yesterday = dayKey(now - 24 * HOUR);
    const byDay = new Map<string, (ActivityEvent & { time: number })[]>();
    for (const e of [...events]
      .map((e) => ({ ...e, time: new Date(e.at).getTime() }))
      .sort((a, b) => b.time - a.time)) {
      const day = dayKey(e.time);
      byDay.set(day, [...(byDay.get(day) ?? []), e]);
    }
    return [...byDay].map(([day, rows]) => ({
      day,
      rows,
      label:
        day === today
          ? "Today"
          : day === yesterday
            ? "Yesterday"
            : dayFmt.format(new Date(rows[0].time)),
    }));
  }, [events, now]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const rows = [
      ...(scroller.current?.querySelectorAll<HTMLElement>("[data-activity-row]") ?? []),
    ];
    const i = rows.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    e.preventDefault();
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? rows.length - 1
          : Math.min(Math.max(i + (e.key === "ArrowDown" ? 1 : -1), 0), rows.length - 1);
    rows[next]?.focus();
  }

  if (events && events.length === 0) {
    return (
      <div className={cn("grid place-items-center p-6 text-center", className)}>
        <div>
          <CheckCircle2 className="mx-auto size-6 text-ok" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium">Quiet week</p>
          <p className="mt-1 text-xs text-muted">
            New SOS alerts, reports and status changes will appear here as they happen.
          </p>
        </div>
      </div>
    );
  }

  let reveal = 0;
  return (
    <div className={cn("relative min-h-0", className)} role="region" aria-label="Live activity">
      <div
        ref={scroller}
        onKeyDown={onKeyDown}
        className={cn("activity-scroller h-full overflow-y-auto", more && "has-more")}
      >
        {!events && (
          <ul className="space-y-4 p-4" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <li key={i} className="flex gap-3">
                <span className="skeleton size-7 shrink-0 rounded-full" />
                <span className="flex-1 space-y-1.5 pt-1">
                  <span className="skeleton block h-3 w-3/4 rounded-full" />
                  <span className="skeleton block h-2.5 w-1/3 rounded-full" />
                </span>
              </li>
            ))}
          </ul>
        )}
        {groups.map((group) => (
          <section key={group.day} aria-labelledby={`activity-${group.day}`}>
            <h3
              id={`activity-${group.day}`}
              className="sticky top-0 z-10 flex items-baseline justify-between gap-2 bg-[var(--glass-strong)] px-4 py-2 text-xs font-semibold backdrop-blur-md"
            >
              {group.label}
              <span className="font-normal text-muted">
                {group.rows.length} {group.rows.length === 1 ? "update" : "updates"}
              </span>
            </h3>
            <ol className="px-2 pb-2">
              {group.rows.map((row, index) => {
                const Icon = row.tone === "success" ? CheckCircle2 : ICONS[row.kind];
                const recent = group.label === "Today" && now - row.time < 12 * HOUR;
                const time = recent
                  ? relative(row.time, now)
                  : { short: clockFmt.format(new Date(row.time)), long: "" };
                const full = recent
                  ? `${time.long}, ${fullFmt.format(new Date(row.time))}`
                  : fullFmt.format(new Date(row.time));
                const isNew = fresh.has(row.id);
                // Rows drawn together are spaced a beat apart so the line reads as drawing down.
                const delay = isNew ? 0 : Math.min(reveal++, 8) * 70;
                const body = (
                  <>
                    <span
                      className="activity-marker relative z-[1] grid size-7 shrink-0 place-items-center rounded-full ring-1"
                      data-tone={row.tone}
                      data-kind={row.kind}
                      aria-hidden="true"
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 pt-0.5">
                      <span className="block text-[13px] leading-snug">
                        {row.actor && <span className="font-semibold">{row.actor} </span>}
                        <span className={row.actor ? "text-muted" : "font-medium"}>
                          {row.title}
                        </span>
                      </span>
                      {row.meta && (
                        <span className="mt-0.5 block truncate text-xs text-muted">{row.meta}</span>
                      )}
                    </span>
                    <time
                      dateTime={new Date(row.time).toISOString()}
                      title={full}
                      className="shrink-0 pt-0.5 font-mono text-[11px] tabular-nums text-muted"
                    >
                      <span aria-hidden="true">{time.short}</span>
                      <span className="sr-only">{full}</span>
                    </time>
                  </>
                );
                const rowClass =
                  "relative flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors";
                return (
                  <li
                    key={row.id}
                    className={cn("activity-row relative", isNew && "is-new")}
                    style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties}
                  >
                    {index < group.rows.length - 1 && (
                      <span className="activity-line" aria-hidden="true" />
                    )}
                    {row.href ? (
                      <Link
                        to={row.href}
                        data-activity-row=""
                        className={cn(rowClass, "hover:bg-panel-2")}
                      >
                        {body}
                      </Link>
                    ) : (
                      <div data-activity-row="" tabIndex={0} className={rowClass}>
                        {body}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
      <span className="sr-only" role="status">
        {announcement}
      </span>
    </div>
  );
}
