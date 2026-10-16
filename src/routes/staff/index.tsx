import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronRight,
  Clock,
  Droplet,
  HeartPulse,
  MapPin,
  Navigation,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { StatusPill } from "@/components/shared/pills";
import { LiveDot, ResponderShell } from "@/components/responder/responder-shell";
import { useViewer } from "@/lib/auth/use-viewer";
import { directionsUrl, useNow } from "@/lib/responder";
import { listAssignedSos } from "@/backend/functions/sos";
import type { SosAlert } from "@/lib/types";
import { cn, waitLabel } from "@/lib/utils";
import { SkeletonCard, SkeletonGroup } from "@/components/shared/skeleton";

export const Route = createFileRoute("/staff/")({ component: Assigned });

/** Alerts still waiting for the responder to reach them. */
const EN_ROUTE = new Set(["sent", "received", "assigned"]);

function Assigned() {
  const viewer = useViewer();
  const [rows, setRows] = useState<SosAlert[] | null>(null);
  const now = useNow(15_000);

  useEffect(() => {
    const load = () =>
      listAssignedSos()
        .then(setRows)
        .catch(() => setRows((r) => r ?? []));
    void load();
    const i = window.setInterval(load, 5000);
    return () => window.clearInterval(i);
  }, []);

  const enRoute = rows?.filter((r) => EN_ROUTE.has(r.status)).length ?? 0;
  const onScene = rows?.filter((r) => r.status === "arrived").length ?? 0;
  const firstName = viewer?.name.split(" ")[0];

  return (
    <ResponderShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted">
            {firstName ? `Hi, ${firstName}` : "Responder"}
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Assigned alerts</h1>
        </div>
        <LiveDot label="Auto-updating" className="sm:hidden" />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Stat label="Active" value={rows?.length} tone="sos" />
        <Stat label="En route" value={rows ? enRoute : undefined} tone="warn" />
        <Stat label="On scene" value={rows ? onScene : undefined} tone="ok" />
      </div>

      {rows === null ? (
        <SkeletonGroup label="Loading alerts" className="mt-5 grid gap-3 md:grid-cols-2">
          {[0, 1].map((i) => (
            <SkeletonCard key={i} lines={3} />
          ))}
        </SkeletonGroup>
      ) : rows.length === 0 ? (
        <AllClear />
      ) : (
        <ul className="mt-5 grid gap-3 md:grid-cols-2">
          {rows.map((s) => (
            <li key={s.id}>
              <AlertCard alert={s} now={now} />
            </li>
          ))}
        </ul>
      )}
    </ResponderShell>
  );
}

function AlertCard({ alert, now }: { alert: SosAlert; now: number }) {
  const urgent = EN_ROUTE.has(alert.status);
  const hasPos = alert.lat != null && alert.lng != null;
  return (
    <article
      className={cn(
        "card glass-hover flex h-full flex-col ring-1 shadow-[var(--neu-raised)]",
        urgent ? "ring-sos/40" : "ring-transparent",
      )}
    >
      <Link to="/staff/$id" params={{ id: alert.id }} className="block flex-1 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-sos">
            <span className="relative flex size-2">
              {urgent && (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-sos opacity-60" />
              )}
              <span className="relative inline-flex size-2 rounded-full bg-sos" />
            </span>
            SOS
          </span>
          <StatusPill status={alert.status} />
        </div>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg font-semibold">{alert.reporterName}</h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
              <MapPin className="size-3.5 shrink-0" />
              {alert.isApproximate
                ? "Approximate location"
                : `Live GPS${alert.accuracyM != null ? ` · ±${Math.round(alert.accuracyM)} m` : ""}`}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-display text-xl font-semibold tabular-nums">
              {waitLabel(alert.startedAt, now)}
            </p>
            <p className="flex items-center justify-end gap-1 text-[11px] text-dim">
              <Clock className="size-3" /> since SOS
            </p>
          </div>
        </div>
        {alert.reporterMedical && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {alert.reporterMedical.bloodGroup && (
              <span className="inline-flex items-center gap-1 rounded-md bg-[var(--sos-fill)] px-2 py-0.5 text-xs font-bold text-white">
                <Droplet className="size-3" /> {alert.reporterMedical.bloodGroup}
              </span>
            )}
            {alert.reporterMedical.medicalNotes && (
              <span className="inline-flex min-w-0 items-center gap-1 truncate text-xs text-muted">
                <HeartPulse className="size-3.5 shrink-0 text-sos" />
                <span className="truncate">{alert.reporterMedical.medicalNotes}</span>
              </span>
            )}
          </div>
        )}
      </Link>
      <div className="grid grid-cols-3 divide-x divide-line overflow-hidden rounded-b-[22px] border-t border-line">
        {alert.reporterPhone ? (
          <a href={`tel:${alert.reporterPhone.replace(/\s/g, "")}`} className={cardAction}>
            <Phone className="size-4 text-neon" /> Call
          </a>
        ) : (
          <span className={cn(cardAction, "text-dim")}>
            <Phone className="size-4" /> No phone
          </span>
        )}
        {hasPos ? (
          <a
            href={directionsUrl(alert.lat!, alert.lng!)}
            target="_blank"
            rel="noreferrer"
            className={cardAction}
          >
            <Navigation className="size-4 text-neon" /> Navigate
          </a>
        ) : (
          <span className={cn(cardAction, "text-dim")}>
            <Navigation className="size-4" /> No fix
          </span>
        )}
        <Link
          to="/staff/$id"
          params={{ id: alert.id }}
          className={cn(cardAction, "font-semibold text-fg")}
        >
          Open <ChevronRight className="size-4" />
        </Link>
      </div>
    </article>
  );
}

const cardAction =
  "flex min-h-12 items-center justify-center gap-1.5 text-xs font-medium text-muted transition-colors hover:bg-panel-2 hover:text-fg";

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | undefined;
  tone: "sos" | "warn" | "ok";
}) {
  const color = { sos: "text-sos", warn: "text-warn", ok: "text-ok" }[tone];
  return (
    <div className="card p-3 sm:p-4">
      <p
        className={cn(
          "font-display text-2xl font-semibold tabular-nums sm:text-3xl",
          value ? color : "text-dim",
        )}
      >
        {value ?? "–"}
      </p>
      <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}

function AllClear() {
  return (
    <EmptyCard>
      <span className="grid size-14 place-items-center rounded-2xl bg-ok/12 text-ok ring-1 ring-ok/25">
        <ShieldCheck className="size-7" />
      </span>
      <h2 className="mt-4 font-display text-xl font-semibold">All clear</h2>
      <p className="mt-1 max-w-sm text-sm text-muted">
        No alerts assigned to you right now. When command dispatches you to an SOS it appears here
        instantly — keep this screen open.
      </p>
    </EmptyCard>
  );
}

function EmptyCard({ children }: { children: ReactNode }) {
  return (
    <div className="mt-5 flex flex-col items-center card px-6 py-12 text-center">{children}</div>
  );
}
