import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronRight,
  Droplet,
  EyeOff,
  FileWarning,
  FolderOpen,
  HeartPulse,
  MapPin,
  Phone,
  ShieldCheck,
  Siren,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { KindChip, StatusPill } from "@/components/shared/pills";
import { MyLocationMap } from "@/components/student/my-location-map";
import { profileCompleteness, useProfilePanel } from "@/components/student/profile-panel";
import { SafeWalkCard } from "@/components/student/safe-walk";
import { useSosFlow } from "@/components/student/sos-flow";
import { useViewer } from "@/lib/auth/use-viewer";
import { CAMPUS, SECURITY_LINE } from "@/lib/campus";
import { listMyIncidents } from "@/backend/functions/reports";
import { listMySos } from "@/backend/functions/sos";
import type { Incident, SosAlert } from "@/lib/types";
import { useLiveLocation } from "@/lib/use-live-location";
import { cn, formatClock } from "@/lib/utils";

export const Route = createFileRoute("/_student/")({
  staticData: { width: "full" },
  component: StudentHome,
});

const OPEN_SOS = new Set(["sent", "received", "assigned", "arrived"]);
const CLOSED = new Set(["resolved", "closed", "cancelled", "false_alarm"]);

type HistoryFilter = "all" | "sos" | "incident";
type HistoryRow = {
  kind: "sos" | "incident";
  id: string;
  at: string;
  title: string;
  status: string;
  sub: string;
};

function StudentHome() {
  const viewer = useViewer();
  const location = useLiveLocation();
  const { shareLiveLocation } = useSosFlow();
  const [sosList, setSosList] = useState<SosAlert[] | null>(null);
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");

  // Hand the map's live GPS fix to the shell's SOS flow for an instant, precise send.
  useEffect(() => {
    shareLiveLocation(location);
  }, [location, shareLiveLocation]);
  useEffect(() => () => shareLiveLocation(null), [shareLiveLocation]);

  useEffect(() => {
    let live = true;
    listMySos()
      .then((s) => live && setSosList(s))
      .catch(() => live && setSosList([]));
    listMyIncidents()
      .then((i) => live && setIncidents(i))
      .catch(() => live && setIncidents([]));
    return () => {
      live = false;
    };
  }, []);

  const allRows: HistoryRow[] | null = useMemo(() => {
    if (!sosList || !incidents) return null;
    return [
      ...sosList.map((s) => ({
        kind: "sos" as const,
        id: s.id,
        at: s.startedAt,
        title: "SOS alert",
        status: s.status,
        sub: s.assignedName ?? (OPEN_SOS.has(s.status) ? "Waiting for responder" : "Closed"),
      })),
      ...incidents.map((i) => ({
        kind: "incident" as const,
        id: i.id,
        at: i.createdAt,
        title: i.categoryName,
        status: i.status,
        sub: i.locationName ?? "GPS pin",
      })),
    ].sort((a, b) => +new Date(b.at) - +new Date(a.at));
  }, [sosList, incidents]);

  const history =
    allRows?.filter((r) => historyFilter === "all" || r.kind === historyFilter) ?? null;
  const openCount = allRows?.filter((r) => !CLOSED.has(r.status)).length ?? 0;
  const firstName = viewer?.name.split(" ")[0] ?? "there";
  const activeSos = sosList?.find((s) => OPEN_SOS.has(s.status));

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4",
        // Phone: greeting, a big map, safety card, reports. SOS lives in the tab bar.
        "[grid-template-areas:'greet'_'map'_'walk'_'safety'_'history']",
        // Tablet: full-width map, then actions; safety beside reports.
        "md:grid-cols-2 md:[grid-template-areas:'greet_greet'_'map_map'_'quick_quick'_'walk_safety'_'history_history']",
        // Desktop: map on the left, a tidy side column on the right — fits the viewport.
        "xl:h-[calc(100dvh-3.5rem)] xl:grid-cols-[minmax(0,1fr)_minmax(340px,380px)]",
        "xl:grid-rows-[auto_auto_auto_auto_minmax(0,1fr)]",
        "xl:[grid-template-areas:'greet_greet'_'map_quick'_'map_walk'_'map_safety'_'map_history']",
      )}
    >
      <header className="space-y-3 [grid-area:greet]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted">Hi, {firstName}</p>
            <h1 className="font-display text-xl font-semibold tracking-tight md:text-2xl">
              Stay safe on campus
            </h1>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <Chip>
              <MapPin className="size-3.5 text-neon" /> {CAMPUS.name}
            </Chip>
            <Chip>
              <FolderOpen className="size-3.5 text-neon" />
              {openCount === 0
                ? "No open cases"
                : `${openCount} open case${openCount === 1 ? "" : "s"}`}
            </Chip>
          </div>
        </div>
        {activeSos && <ActiveSosBanner id={activeSos.id} className="rounded-xl" />}
      </header>

      {/* Live campus map — the centrepiece. */}
      <section
        className="card flex min-h-0 flex-col overflow-hidden rounded-[28px] p-1.5 [grid-area:map]"
        aria-label="Live campus map"
      >
        <MyLocationMap
          location={location}
          className="rounded-[22px] h-[calc(100dvh-17rem-var(--safe-top)-var(--safe-bottom))] min-h-[340px] flex-none md:h-[440px] xl:h-auto xl:min-h-0 xl:flex-1"
        />
      </section>

      {/* Quick actions — tablet and desktop (phones have the tab bar). */}
      <nav
        className="hidden grid-cols-3 gap-3 [grid-area:quick] md:grid"
        aria-label="Quick actions"
      >
        <Quick to="/report" icon={FileWarning} label="Report" />
        <Quick to="/anonymous" icon={EyeOff} label="Anonymous" tone="violet" />
        <Quick to="/reports" icon={FolderOpen} label="My reports" />
      </nav>

      <SafeWalkCard className="[grid-area:walk]" />

      <SafetyCard className="[grid-area:safety]" />

      {/* Everything the student has filed, newest first. */}
      <Panel
        title="My reports"
        className="[grid-area:history]"
        bodyClassName="xl:min-h-0 xl:flex-1 xl:overflow-y-auto"
        action={<ViewAll />}
        toolbar={
          <div className="seg w-full [&>button]:flex-1" role="group" aria-label="Filter reports">
            {(
              [
                ["all", "All"],
                ["sos", "SOS"],
                ["incident", "Incidents"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={historyFilter === id}
                onClick={() => setHistoryFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        {history === null ? (
          <Skeleton rows={3} />
        ) : history.length === 0 ? (
          <Empty>
            {historyFilter === "all"
              ? "Nothing filed yet. Your SOS alerts and reports will appear here."
              : "Nothing here yet."}
          </Empty>
        ) : (
          <ul className="space-y-2">
            {history.slice(0, 12).map((r) => (
              <li key={`${r.kind}-${r.id}`}>
                <Link
                  to={r.kind === "sos" ? "/sos/$id" : "/reports/$id"}
                  params={{ id: r.id }}
                  className="flex min-h-14 items-center gap-3 rounded-xl bg-panel-2 p-3 ring-1 ring-line transition-colors hover:ring-line-strong"
                >
                  <KindChip kind={r.kind} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.title}</span>
                    <span className="block truncate text-[11px] text-muted">
                      {r.sub} · {formatClock(r.at)}
                    </span>
                  </span>
                  <StatusPill status={r.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/** Medical ID status (or a nudge to fill it in) plus a one-tap call to campus security. */
function SafetyCard({ className }: { className?: string }) {
  const { profile, open } = useProfilePanel();
  const completeness = profile ? profileCompleteness(profile) : null;
  const ready = completeness?.missing.length === 0;

  return (
    <section className={cn("card overflow-hidden", className)} aria-labelledby="safety-title">
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 id="safety-title" className="flex items-center gap-2 text-sm font-semibold">
            <HeartPulse className="size-4 text-sos" /> Your medical ID
          </h2>
          {profile && (
            <button
              type="button"
              onClick={() => open("medical")}
              className="inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-medium text-neon hover:bg-panel-2"
            >
              {ready ? "Edit" : "Complete"}
            </button>
          )}
        </div>

        {!profile || !completeness ? (
          <div className="mt-3 h-12 animate-pulse rounded-xl bg-panel-2" />
        ) : ready ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {profile.bloodGroup && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-sos px-2.5 py-1 text-sm font-bold text-white">
                <Droplet className="size-3.5" /> {profile.bloodGroup}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate text-xs text-muted">
              Emergency contact: <span className="text-fg">{profile.emergencyName}</span>
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[11px] font-medium",
                profile.shareMedical ? "text-ok" : "text-warn",
              )}
            >
              <ShieldCheck className="size-3.5" />
              {profile.shareMedical ? "Shared in SOS" : "Not shared"}
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => open("medical")}
            className="mt-3 block w-full text-left"
          >
            <span className="flex items-center justify-between text-xs">
              <span className="text-muted">
                Add your {completeness.missing.slice(0, 2).join(" & ")}
              </span>
              <span className="font-medium">{completeness.percent}%</span>
            </span>
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-panel-2">
              <span
                className="block h-full rounded-full bg-accent"
                style={{ width: `${completeness.percent}%` }}
              />
            </span>
            <span className="mt-2 block text-[11px] text-dim">
              Responders see this during your SOS, so they can help faster.
            </span>
          </button>
        )}
      </div>

      <a
        href={`tel:${SECURITY_LINE.phone.replaceAll(" ", "")}`}
        className="flex min-h-12 items-center gap-3 border-t border-line bg-sos/5 px-4 py-2.5 transition-colors hover:bg-sos/10"
      >
        <span className="grid size-8 place-items-center rounded-lg bg-sos/15 text-sos">
          <Phone className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">Call {SECURITY_LINE.label}</span>
          <span className="block font-mono text-[11px] text-muted">
            {SECURITY_LINE.phone} · 24/7
          </span>
        </span>
        <ChevronRight className="size-4 text-dim" />
      </a>
    </section>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-panel px-3 text-xs text-muted ring-1 ring-line">
      {children}
    </span>
  );
}

function ActiveSosBanner({ id, className }: { id: string; className?: string }) {
  return (
    <Link
      to="/sos/$id"
      params={{ id }}
      className={cn(
        "flex min-h-11 items-center gap-3 bg-sos px-4 py-2.5 text-sm font-semibold text-white",
        className,
      )}
    >
      <Siren className="size-4 shrink-0" />
      <span className="flex-1">Your SOS is active — tap to view</span>
      <ChevronRight className="size-4" />
    </Link>
  );
}
function Panel({
  title,
  action,
  toolbar,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  action?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("card flex min-h-0 flex-col", className)}>
      <header className="flex min-h-12 items-center justify-between gap-2 px-4 pt-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </header>
      {toolbar && <div className="px-4 pt-3">{toolbar}</div>}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

function ViewAll() {
  return (
    <Link
      to="/reports"
      className="inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-medium text-neon hover:bg-panel-2"
    >
      View all
    </Link>
  );
}

function Skeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-xl bg-panel-2" />
      ))}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-4 text-center text-sm text-muted">{children}</p>;
}

function Quick({
  to,
  icon: Icon,
  label,
  tone = "neon",
}: {
  to: "/report" | "/anonymous" | "/reports";
  icon: typeof FileWarning;
  label: string;
  tone?: "neon" | "violet";
}) {
  return (
    <Link
      to={to}
      className="card glass-hover flex min-h-[76px] flex-col items-center justify-center gap-1.5 p-2 text-center"
    >
      <span
        className={cn(
          "grid size-10 place-items-center rounded-xl",
          tone === "violet" ? "bg-violet/12 text-violet" : "bg-neon-dim text-neon",
        )}
      >
        <Icon className="size-[18px]" />
      </span>
      <span className="text-xs font-semibold">{label}</span>
    </Link>
  );
}
