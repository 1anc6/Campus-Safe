import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronRight,
  CircleCheck,
  FileWarning,
  FolderOpen,
  MapPin,
  Siren,
  Timer,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SeverityChip, StatusPill } from "@/components/shared/pills";
import { PageHeading } from "@/components/student/student-shell";
import { listMyIncidents } from "@/backend/functions/reports";
import { listMySos } from "@/backend/functions/sos";
import type { Incident, SosAlert } from "@/lib/types";
import { cn, formatClock, waitLabel } from "@/lib/utils";
import { SkeletonCard, SkeletonGroup } from "@/components/shared/skeleton";

export const Route = createFileRoute("/_student/reports/")({
  staticData: { width: "wide" },
  component: MyReports,
});

type Filter = "all" | "sos" | "incident";
type Row =
  { kind: "sos"; at: string; sos: SosAlert } | { kind: "incident"; at: string; incident: Incident };

const OPEN_SOS = new Set(["sent", "received", "assigned", "arrived"]);
const OPEN_INCIDENT = new Set(["reported", "under_review", "in_progress"]);

function MyReports() {
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [sos, setSos] = useState<SosAlert[] | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    listMyIncidents()
      .then(setIncidents)
      .catch(() => {
        setIncidents([]);
        setError(true);
      });
    listMySos()
      .then(setSos)
      .catch(() => {
        setSos([]);
        setError(true);
      });
  }, []);

  const loading = incidents === null || sos === null;

  const rows: Row[] = useMemo(() => {
    const all: Row[] = [
      ...(sos ?? []).map((s) => ({ kind: "sos" as const, at: s.startedAt, sos: s })),
      ...(incidents ?? []).map((i) => ({
        kind: "incident" as const,
        at: i.createdAt,
        incident: i,
      })),
    ];
    return all
      .filter((r) => filter === "all" || r.kind === filter)
      .sort((a, b) => +new Date(b.at) - +new Date(a.at));
  }, [sos, incidents, filter]);

  const total = (sos?.length ?? 0) + (incidents?.length ?? 0);
  const open =
    (sos ?? []).filter((s) => OPEN_SOS.has(s.status)).length +
    (incidents ?? []).filter((i) => OPEN_INCIDENT.has(i.status)).length;

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: total },
    { id: "sos", label: "SOS", count: sos?.length ?? 0 },
    { id: "incident", label: "Incidents", count: incidents?.length ?? 0 },
  ];

  return (
    <>
      <PageHeading
        title="My reports"
        subtitle="Every SOS and incident you've filed, with live status."
      />

      <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
        <Stat
          icon={FolderOpen}
          label="Total filed"
          value={loading ? "–" : total}
          tone="bg-neon-dim text-neon"
        />
        <Stat icon={Timer} label="Open" value={loading ? "–" : open} tone="bg-warn/15 text-warn" />
        <Stat
          icon={CircleCheck}
          label="Closed"
          value={loading ? "–" : total - open}
          tone="bg-ok/15 text-ok"
        />
      </div>

      <div
        className="seg mb-4 w-full sm:w-auto sm:self-start [&>button]:flex-1 sm:[&>button]:flex-none"
        role="group"
        aria-label="Filter"
      >
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
          >
            {f.label} <span className="ml-1 font-mono text-[11px] opacity-70">{f.count}</span>
          </button>
        ))}
      </div>

      {error && (
        <p className="card mb-4 p-3 text-sm text-sos" role="alert">
          Some of your history could not be loaded. Reload the page to try again.
        </p>
      )}

      {loading && (
        <SkeletonGroup label="Loading your reports" className="grid gap-3 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </SkeletonGroup>
      )}

      {!loading && rows.length === 0 && (
        <div className="card flex flex-col items-center p-10 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-panel-2 text-dim">
            <FileWarning className="size-6" />
          </span>
          <p className="mt-3 font-medium">{filter === "all" ? "No filings yet" : "Nothing here"}</p>
          <p className="mt-1 text-sm text-muted">
            Hold the red SOS button in an emergency, or file an incident from Report.
          </p>
          <Link to="/report" className="btn-neon mt-5">
            Report an incident
          </Link>
        </div>
      )}

      <ul className={cn("grid gap-3", rows.length > 1 && "md:grid-cols-2")}>
        {rows.map((r) =>
          r.kind === "sos" ? (
            <li key={`sos-${r.sos.id}`}>
              <SosCard s={r.sos} />
            </li>
          ) : (
            <li key={`inc-${r.incident.id}`}>
              <IncidentCard i={r.incident} />
            </li>
          ),
        )}
      </ul>
    </>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof FolderOpen;
  label: string;
  value: number | string;
  tone: string;
}) {
  return (
    <div className="card flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", tone)}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="font-display text-xl font-bold tabular-nums leading-tight">{value}</p>
        <p className="truncate text-xs text-muted">{label}</p>
      </div>
    </div>
  );
}

function SosCard({ s }: { s: SosAlert }) {
  const open = OPEN_SOS.has(s.status);
  const lastedMs = s.resolvedAt
    ? new Date(s.resolvedAt).getTime() - new Date(s.startedAt).getTime()
    : null;
  const lasted =
    lastedMs == null || open
      ? null
      : lastedMs < 60_000
        ? "Closed in under a minute"
        : `Closed after ${waitLabel(s.startedAt, new Date(s.resolvedAt!).getTime())}`;
  return (
    <Link
      to="/sos/$id"
      params={{ id: s.id }}
      className={cn(
        "card group flex h-full items-start gap-3 p-4 transition-colors hover:bg-panel-2",
        open && "ring-1 ring-sos/40",
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sos/15 text-sos">
        <Siren className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium">SOS alert</p>
          <StatusPill status={s.status} />
        </div>
        <p className="mt-0.5 text-xs text-muted">{formatClock(s.startedAt)}</p>
        <p className="mt-2 text-xs text-dim">
          {open ? "Active — tap to see responder status" : (lasted ?? "Closed")}
          {s.assignedName ? ` · ${s.assignedName}` : ""}
        </p>
      </div>
      <ChevronRight className="mt-1 size-4 shrink-0 text-dim group-hover:text-fg" />
    </Link>
  );
}

function IncidentCard({ i }: { i: Incident }) {
  return (
    <Link
      to="/reports/$id"
      params={{ id: i.id }}
      className="card group flex h-full items-start gap-3 p-4 transition-colors hover:bg-panel-2"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-neon-dim text-neon">
        <FileWarning className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate font-medium">{i.categoryName}</p>
          <StatusPill status={i.status} />
        </div>
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted">
          <MapPin className="size-3 shrink-0" />
          {i.locationName ?? "GPS pin"} · {formatClock(i.createdAt)}
        </p>
        <p className="mt-2 line-clamp-1 text-xs text-dim">{i.description}</p>
        <div className="mt-2">
          <SeverityChip value={i.severity} />
        </div>
      </div>
      <ChevronRight className="mt-1 size-4 shrink-0 text-dim group-hover:text-fg" />
    </Link>
  );
}
