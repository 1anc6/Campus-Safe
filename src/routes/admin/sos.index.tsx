import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  CheckCircle2,
  Crosshair,
  LocateFixed,
  MapPinOff,
  Phone,
  ShieldCheck,
  SignalLow,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DashCard } from "@/components/admin/dash-card";
import { LiveMap, type MapMarker } from "@/components/shared/live-map";
import { StatusPill } from "@/components/shared/pills";
import { CAMPUS } from "@/lib/campus";
import { getLive } from "@/backend/functions/admin";
import type { LivePayload, RecentSos, SosAlert } from "@/lib/types";
import { cn, formatClock, waitLabel } from "@/lib/utils";
import { SkeletonList } from "@/components/shared/skeleton";

export const Route = createFileRoute("/admin/sos/")({ component: SosBoard });

/** A live alert whose last GPS point is older than this is flagged as stale. */
const STALE_MS = 60_000;

const LEGEND = [
  { label: "SOS", dot: "bg-sos" },
  { label: "Incident", dot: "bg-neon" },
  { label: "Anonymous", dot: "bg-violet" },
];

function hasFix(s: SosAlert) {
  return s.lat != null && s.lng != null;
}

type GpsTone = "ok" | "approx" | "stale";

/** "±12 m · updated 8s ago" / "No GPS — approximate area" / "Signal lost". */
function gpsLine(s: SosAlert, now: number): { text: string; tone: GpsTone } {
  if (!hasFix(s)) return { text: "Waiting for location", tone: "stale" };
  const age = s.lastPingAt ? now - new Date(s.lastPingAt).getTime() : null;
  const when = s.lastPingAt ? `updated ${waitLabel(s.lastPingAt, now)} ago` : "";
  if (age != null && age > STALE_MS) {
    return { text: `Signal lost · last ${waitLabel(s.lastPingAt!, now)} ago`, tone: "stale" };
  }
  if (s.isApproximate) {
    return { text: `No GPS — approximate area only${when ? ` · ${when}` : ""}`, tone: "approx" };
  }
  const acc = s.accuracyM != null ? `±${Math.round(s.accuracyM)} m` : "GPS";
  return { text: `${acc} · ${when}`, tone: "ok" };
}

const GPS_TONE: Record<GpsTone, string> = {
  ok: "text-ok",
  approx: "text-warn",
  stale: "text-warn",
};

function GpsIcon({ tone }: { tone: GpsTone }) {
  if (tone === "ok") return <Crosshair className="size-3.5 shrink-0" />;
  if (tone === "approx") return <MapPinOff className="size-3.5 shrink-0" />;
  return <SignalLow className="size-3.5 shrink-0" />;
}

function closedLabel(r: RecentSos) {
  if (r.closedBy === "reporter") return "Marked safe by student";
  if (r.closedBy === "cancelled") return "Cancelled by student";
  return "Resolved by command";
}

/** Live SOS board: campus map with live GPS trails beside the alert list. */
function SosBoard() {
  const [live, setLive] = useState<LivePayload | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [recenter, setRecenter] = useState(0);
  const seen = useRef<Set<string> | null>(null);
  const announced = useRef<Set<string>>(new Set());

  useEffect(() => {
    const load = () =>
      getLive()
        .then((d) => {
          setLive(d);
          setError(false);
          // Bring a brand-new alert into view automatically.
          const ids = d.sos.map((s) => s.id);
          if (seen.current) {
            const fresh = d.sos.find((s) => !seen.current!.has(s.id) && hasFix(s));
            if (fresh) setFocusId(fresh.id);
          }
          // Announce alerts that left the live list since the last poll.
          if (seen.current) {
            for (const r of d.recentSos) {
              if (seen.current.has(r.id) && !announced.current.has(r.id)) {
                announced.current.add(r.id);
                const msg = `${r.reporterName}: ${closedLabel(r).toLowerCase()}`;
                if (r.closedBy === "reporter") toast.success(msg);
                else toast(msg);
              }
            }
          }
          seen.current = new Set(ids);
        })
        .catch(() => setError(true));
    void load();
    const i = window.setInterval(load, 5000);
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(i);
      window.clearInterval(t);
    };
  }, []);

  const alerts = live?.sos ?? null;
  const recent = live?.recentSos ?? [];
  const focused = alerts?.find((s) => s.id === focusId) ?? null;
  const focusedRecent = focused ? null : (recent.find((r) => r.id === focusId) ?? null);

  const markers: MapMarker[] = useMemo(() => {
    if (!live) return [];
    return [
      ...live.incidents.map((i) => ({
        id: i.id,
        lat: i.lat,
        lng: i.lng,
        kind: "incident" as const,
        severity: i.severity,
        label: "Incident",
      })),
      ...live.anonymous.map((a) => ({
        id: a.id,
        lat: a.lat,
        lng: a.lng,
        kind: "anonymous" as const,
        severity: a.severity,
        label: "Anonymous report",
      })),
      ...live.sos.filter(hasFix).map((s) => ({
        id: s.id,
        lat: s.lat!,
        lng: s.lng!,
        kind: "sos" as const,
        label: s.isApproximate
          ? `SOS · ${s.reporterName} (approximate — no GPS)`
          : `SOS · ${s.reporterName}`,
        approx: s.isApproximate,
        // Approximate positions always show their uncertainty; precise ones when selected.
        accuracyM: s.isApproximate
          ? Math.max(s.accuracyM ?? 0, 80)
          : s.id === focusId
            ? s.accuracyM
            : null,
      })),
      ...(focusedRecent && focusedRecent.lat != null && focusedRecent.lng != null
        ? [
            {
              id: focusedRecent.id,
              lat: focusedRecent.lat,
              lng: focusedRecent.lng,
              kind: "resolved" as const,
              label: `${focusedRecent.reporterName} · ${closedLabel(focusedRecent)}`,
              approx: focusedRecent.isApproximate,
            },
          ]
        : []),
    ];
  }, [live, focusId, focusedRecent]);

  const trails = useMemo(
    () =>
      (live?.trails ?? []).map((t) => ({
        id: t.alertId,
        points: t.points,
        highlight: t.alertId === focusId,
      })),
    [live, focusId],
  );

  const focus =
    focused && hasFix(focused)
      ? { lat: focused.lat!, lng: focused.lng! }
      : focusedRecent && focusedRecent.lat != null && focusedRecent.lng != null
        ? { lat: focusedRecent.lat, lng: focusedRecent.lng }
        : null;

  return (
    <div className="space-y-5 p-4 sm:p-5 lg:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">SOS alerts</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted">
            <span
              className={cn("size-2 rounded-full", error ? "bg-sos" : "pulse-dot bg-ok")}
              aria-hidden="true"
            />
            {error ? "Live feed interrupted — retrying" : `Live GPS tracking · ${CAMPUS.name}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFocusId(null);
            setRecenter((n) => n + 1);
          }}
          className="btn-ghost self-start sm:self-auto"
        >
          <LocateFixed className="size-4 text-neon" /> Campus view
        </button>
      </header>

      <div className="grid gap-4 lg:h-[calc(100dvh-12rem)] lg:min-h-[540px] lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        <DashCard
          title="Live campus map"
          bodyClassName="relative h-[420px] flex-none p-0 sm:h-[480px] sm:p-0 lg:h-auto lg:flex-1"
          actions={
            <ul
              className="flex flex-wrap items-center gap-3 text-xs text-muted"
              aria-label="Map legend"
            >
              {LEGEND.map((l) => (
                <li key={l.label} className="flex items-center gap-1.5">
                  <span className={cn("size-2.5 rounded-full", l.dot)} aria-hidden="true" />
                  {l.label}
                </li>
              ))}
            </ul>
          }
        >
          <LiveMap
            markers={markers}
            trails={trails}
            focus={focus}
            recenter={recenter}
            className="absolute inset-0 h-full w-full"
          />
          {focused && <FocusStrip alert={focused} now={now} onClose={() => setFocusId(null)} />}
          {focusedRecent && (
            <ClosedStrip alert={focusedRecent} now={now} onClose={() => setFocusId(null)} />
          )}
        </DashCard>

        <DashCard
          title="Live alerts"
          badge={alerts ? String(alerts.length) : undefined}
          bodyClassName="lg:max-h-none"
        >
          {!alerts && !error && <SkeletonList rows={3} />}
          {alerts?.length === 0 && recent.length === 0 && (
            <div className="flex flex-col items-center px-4 py-12 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-ok/12 text-ok">
                <ShieldCheck className="size-6" />
              </span>
              <p className="mt-3 font-medium">All clear</p>
              <p className="mt-1 text-sm text-muted">
                No live SOS. A student's alert appears here within 5 seconds.
              </p>
            </div>
          )}
          {alerts?.length === 0 && recent.length > 0 && (
            <p className="mb-3 flex items-center gap-2 rounded-xl bg-ok/10 px-3 py-2.5 text-sm text-ok ring-1 ring-ok/25">
              <ShieldCheck className="size-4" /> All clear — no live SOS right now.
            </p>
          )}
          <ul className="space-y-2">
            {alerts?.map((s) => {
              const on = s.id === focusId;
              const gps = gpsLine(s, now);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setFocusId(on ? null : s.id)}
                    aria-pressed={on}
                    className={cn(
                      "relative w-full overflow-hidden rounded-xl p-3 pl-4 text-left ring-1 transition-colors",
                      on ? "bg-panel-2 ring-sos/50" : "ring-line hover:bg-panel-2/60",
                    )}
                  >
                    <span
                      className="absolute inset-y-2 left-1.5 w-1 rounded-full bg-sos"
                      aria-hidden="true"
                    />
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{s.reporterName}</p>
                        <p className="truncate text-xs text-muted">
                          {formatClock(s.startedAt)} · waiting {waitLabel(s.startedAt, now)}
                        </p>
                      </div>
                      <StatusPill status={s.status} />
                    </div>
                    <p className={cn("mt-2 flex items-center gap-1.5 text-xs", GPS_TONE[gps.tone])}>
                      <GpsIcon tone={gps.tone} />
                      {gps.text}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-dim">
                      {s.assignedName ? `Assigned: ${s.assignedName}` : "Unassigned"}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
          {recent.length > 0 && (
            <section className="mt-5">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
                Closed in the last 24 hours
              </h3>
              <ul className="space-y-2">
                {recent.map((r) => {
                  const on = r.id === focusId;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => setFocusId(on ? null : r.id)}
                        aria-pressed={on}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-xl p-3 text-left ring-1 transition-colors",
                          on ? "bg-panel-2 ring-ok/50" : "ring-line hover:bg-panel-2/60",
                        )}
                      >
                        <CheckCircle2
                          className={cn(
                            "mt-0.5 size-4 shrink-0",
                            r.closedBy === "cancelled" ? "text-muted" : "text-ok",
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate font-medium">{r.reporterName}</p>
                            <StatusPill status={r.status} />
                          </div>
                          <p
                            className={cn(
                              "text-xs",
                              r.closedBy === "reporter" ? "text-ok" : "text-muted",
                            )}
                          >
                            {closedLabel(r)} · {waitLabel(r.closedAt, now)} ago
                          </p>
                          <p className="truncate text-xs text-dim">
                            Raised {formatClock(r.startedAt)}
                            {r.assignedName ? ` · ${r.assignedName}` : ""}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </DashCard>
      </div>
    </div>
  );
}

/** Details for the selected alert, docked over the bottom of the map. */
function FocusStrip({
  alert,
  now,
  onClose,
}: {
  alert: SosAlert;
  now: number;
  onClose: () => void;
}) {
  const gps = gpsLine(alert, now);
  return (
    <div className="absolute inset-x-3 bottom-3 z-[500] flex flex-wrap items-center gap-3 rounded-xl bg-chrome/95 p-3 ring-1 ring-sos/40 backdrop-blur sm:inset-x-4 sm:bottom-4">
      <span
        className="size-2.5 shrink-0 rounded-full bg-sos shadow-[0_0_10px_rgb(255,59,78,.7)]"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{alert.reporterName}</p>
        <p className={cn("truncate text-xs", gps.tone === "ok" ? "text-muted" : "text-warn")}>
          {gps.text}
          {alert.assignedName ? ` · ${alert.assignedName}` : " · Unassigned"}
        </p>
      </div>
      {alert.reporterPhone && (
        <a href={`tel:${alert.reporterPhone}`} className="btn-ghost min-h-9 px-3 text-xs">
          <Phone className="size-3.5" /> Call
        </a>
      )}
      <Link to="/admin/sos/$id" params={{ id: alert.id }} className="btn-neon min-h-9 px-3 text-xs">
        Open case <ArrowUpRight className="size-3.5" />
      </Link>
      <button
        type="button"
        onClick={onClose}
        className="grid size-9 place-items-center rounded-lg text-muted hover:bg-panel-2"
        aria-label="Close details"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

/** Summary for a closed alert, docked over the map. */
function ClosedStrip({
  alert,
  now,
  onClose,
}: {
  alert: RecentSos;
  now: number;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-x-3 bottom-3 z-[500] flex flex-wrap items-center gap-3 rounded-xl bg-chrome/95 p-3 ring-1 ring-ok/40 backdrop-blur sm:inset-x-4 sm:bottom-4">
      <CheckCircle2 className="size-5 shrink-0 text-ok" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{alert.reporterName}</p>
        <p className="truncate text-xs text-muted">
          {closedLabel(alert)} · {waitLabel(alert.closedAt, now)} ago
          {alert.isApproximate ? " · last location was approximate" : ""}
        </p>
      </div>
      <Link
        to="/admin/sos/$id"
        params={{ id: alert.id }}
        className="btn-ghost min-h-9 px-3 text-xs"
      >
        View case <ArrowUpRight className="size-3.5" />
      </Link>
      <button
        type="button"
        onClick={onClose}
        className="grid size-9 place-items-center rounded-lg text-muted hover:bg-panel-2"
        aria-label="Close details"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
