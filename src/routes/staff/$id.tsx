import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Footprints,
  LoaderCircle,
  MapPin,
  Navigation,
  Phone,
  Siren,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { LiveMap, type MapMarker } from "@/components/shared/live-map";
import { MedicalCard } from "@/components/shared/medical-card";
import { StatusPill } from "@/components/shared/pills";
import { ResponderShell } from "@/components/responder/responder-shell";
import { distanceM, SOS_STEPS } from "@/lib/campus";
import { directionsUrl, formatDistance, useNow } from "@/lib/responder";
import { getSos, setSosStatus } from "@/backend/functions/sos";
import type { SosAlert, SosPoint } from "@/lib/types";
import { useLiveLocation } from "@/lib/use-live-location";
import { cn, formatClock, waitLabel } from "@/lib/utils";

export const Route = createFileRoute("/staff/$id")({ component: AssignedAlert });

type Action = "assigned" | "arrived" | "resolved";

/** The one thing the responder should do next, per status. */
const NEXT: Partial<Record<SosAlert["status"], { action: Action; label: string; hint: string }>> = {
  sent: { action: "assigned", label: "On my way", hint: "Tell the student help is coming." },
  received: { action: "assigned", label: "On my way", hint: "Tell the student help is coming." },
  assigned: { action: "arrived", label: "I've arrived", hint: "Mark when you reach the student." },
  arrived: {
    action: "resolved",
    label: "Resolve alert",
    hint: "Close the SOS once the student is safe.",
  },
};

const STEPS = SOS_STEPS.filter((s) => s.id !== "cancelled");

function AssignedAlert() {
  const { id } = Route.useParams();
  const [alert, setAlert] = useState<SosAlert | null>(null);
  const [trail, setTrail] = useState<SosPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [confirmResolve, setConfirmResolve] = useState(false);
  const me = useLiveLocation();
  const now = useNow(1000);

  const load = useCallback(async () => {
    const d = await getSos({ data: { id } });
    setAlert(d.alert);
    setTrail(d.trail);
  }, [id]);

  useEffect(() => {
    load().catch(() => setError("This alert isn't assigned to you, or it no longer exists."));
    const i = window.setInterval(() => void load().catch(() => {}), 5000);
    return () => window.clearInterval(i);
  }, [load]);

  const update = async (status: Action) => {
    // Resolving closes the SOS for everyone — ask for a second tap.
    if (status === "resolved" && !confirmResolve) {
      setConfirmResolve(true);
      window.setTimeout(() => setConfirmResolve(false), 4000);
      return;
    }
    setBusy(status);
    try {
      await setSosStatus({ data: { id, status } });
      await load();
      setConfirmResolve(false);
      toast.success(
        status === "resolved" ? "Alert resolved" : "Status updated — the student can see it",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(null);
    }
  };

  if (!alert) {
    return (
      <ResponderShell>
        <div className="grid min-h-[60dvh] place-items-center text-center text-sm">
          {error ? (
            <div>
              <p className="text-sos">{error}</p>
              <Link to="/staff" className="btn-ghost mt-4">
                <ArrowLeft className="size-4" /> Assigned alerts
              </Link>
            </div>
          ) : (
            <LoaderCircle className="size-6 animate-spin text-muted" aria-label="Loading alert" />
          )}
        </div>
      </ResponderShell>
    );
  }

  const pos = alert.lat != null && alert.lng != null ? { lat: alert.lat, lng: alert.lng } : null;
  const myFix = me.status === "live" && me.fix && !me.fix.approx ? me.fix : null;
  const away = pos && myFix ? distanceM(myFix, pos) : null;
  const closed = alert.status === "resolved" || alert.status === "cancelled";
  const next = NEXT[alert.status];
  const stepIndex = STEPS.findIndex((s) => s.id === alert.status);

  const markers: MapMarker[] = [
    ...(pos ? [{ id: alert.id, ...pos, kind: "sos" as const, label: alert.reporterName }] : []),
    ...(myFix
      ? [{ id: "me", lat: myFix.lat, lng: myFix.lng, kind: "unit" as const, label: "You" }]
      : []),
  ];

  return (
    <ResponderShell className="pb-[calc(7rem+var(--safe-bottom))] lg:pb-8">
      {/* Title row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/staff"
            className="-ml-2 inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted hover:text-fg"
          >
            <ArrowLeft className="size-3.5" /> Assigned alerts
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="truncate font-display text-2xl font-semibold tracking-tight">
              {alert.reporterName}
            </h1>
            <StatusPill status={alert.status} />
          </div>
          {alert.notes && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-warn/15 px-3 py-1 text-xs font-semibold text-warn">
              Auto-raised: {alert.notes}
            </p>
          )}
        </div>
        <div
          className={cn(
            "rounded-2xl px-4 py-2 text-right ring-1",
            closed ? "ring-line" : "bg-sos/5 ring-sos/25",
          )}
        >
          <p
            className={cn(
              "font-display text-2xl font-semibold tabular-nums",
              !closed && "text-sos",
            )}
          >
            {waitLabel(
              alert.startedAt,
              closed && alert.resolvedAt ? new Date(alert.resolvedAt).getTime() : now,
            )}
          </p>
          <p className="flex items-center justify-end gap-1 text-[11px] text-muted">
            <Clock className="size-3" /> {closed ? "total time" : "since SOS"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Map */}
        <section className="relative h-[46dvh] min-h-[300px] overflow-hidden rounded-2xl ring-1 ring-line lg:h-[calc(100dvh-12rem)] lg:min-h-[480px]">
          <LiveMap markers={markers} trail={trail} focus={pos} className="h-full w-full" />
          <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] flex flex-wrap items-start justify-between gap-2">
            <span className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-chrome/90 py-1.5 pl-2 pr-3 text-xs font-medium shadow-lg ring-1 ring-line backdrop-blur">
              <span className="grid size-6 place-items-center rounded-full bg-sos/15 text-sos">
                <MapPin className="size-3.5" />
              </span>
              {pos
                ? alert.isApproximate
                  ? "Approximate location"
                  : `Live GPS${alert.accuracyM != null ? ` · ±${Math.round(alert.accuracyM)} m` : ""}`
                : "No location yet"}
            </span>
            {away != null && (
              <span className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-chrome/90 px-3 py-1.5 text-xs font-semibold shadow-lg ring-1 ring-neon/30 backdrop-blur">
                <Footprints className="size-3.5 text-neon" /> {formatDistance(away)} away
              </span>
            )}
          </div>
          {pos && (
            <a
              href={directionsUrl(pos.lat, pos.lng)}
              target="_blank"
              rel="noreferrer"
              className="absolute bottom-4 left-3 z-[500] inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-ink shadow-lg"
            >
              <Navigation className="size-4" /> Navigate
            </a>
          )}
        </section>

        {/* Side column */}
        <aside className="space-y-4">
          {/* Next action — desktop (phones get the sticky bar) */}
          <section className="hidden card p-4 lg:block">
            <Progress index={stepIndex} closed={closed} />
            {closed ? (
              <ClosedNote alert={alert} />
            ) : (
              next && (
                <div className="mt-4">
                  <ActionButton
                    next={next}
                    busy={busy}
                    confirm={confirmResolve}
                    onClick={() => void update(next.action)}
                  />
                  <p className="mt-2 text-center text-[11px] text-muted">
                    {confirmResolve ? "Tap again to confirm." : next.hint}
                  </p>
                </div>
              )
            )}
          </section>

          {/* Progress on phones */}
          <section className="card p-4 lg:hidden">
            <Progress index={stepIndex} closed={closed} />
            {closed && <ClosedNote alert={alert} />}
          </section>

          {/* Student */}
          <section className="card p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              Student
            </h2>
            <div className="mt-3 flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-sos/12 font-display text-lg font-semibold text-sos">
                {alert.reporterName.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{alert.reporterName}</p>
                <p className="text-xs text-muted">SOS at {formatClock(alert.startedAt)}</p>
              </div>
            </div>
            {alert.reporterPhone ? (
              <a
                href={`tel:${alert.reporterPhone.replace(/\s/g, "")}`}
                className="btn-ghost mt-3 w-full text-neon"
              >
                <Phone className="size-4" /> Call {alert.reporterPhone}
              </a>
            ) : (
              <p className="mt-3 rounded-xl bg-panel-2 p-3 text-xs text-muted ring-1 ring-line">
                No phone number on the student's profile.
              </p>
            )}
            <MedicalCard info={alert.reporterMedical} className="mt-3" />
          </section>
        </aside>
      </div>

      {/* Sticky next action on phones */}
      {!closed && next && (
        <div className="fixed inset-x-0 bottom-0 z-[600] border-t border-line bg-chrome/95 px-4 pb-[max(0.75rem,var(--safe-bottom))] pt-3 backdrop-blur-md lg:hidden">
          <ActionButton
            next={next}
            busy={busy}
            confirm={confirmResolve}
            onClick={() => void update(next.action)}
          />
          <p className="mt-1.5 text-center text-[11px] text-muted">
            {confirmResolve ? "Tap again to confirm." : next.hint}
          </p>
        </div>
      )}
    </ResponderShell>
  );
}

function ActionButton({
  next,
  busy,
  confirm,
  onClick,
}: {
  next: NonNullable<(typeof NEXT)[keyof typeof NEXT]>;
  busy: Action | null;
  confirm: boolean;
  onClick: () => void;
}) {
  const tone =
    next.action === "resolved"
      ? "bg-ok text-ink"
      : next.action === "arrived"
        ? "bg-warn text-ink"
        : "bg-accent text-ink shadow-[0_4px_16px_var(--neon-glow)]";
  const Icon =
    next.action === "resolved" ? CheckCircle2 : next.action === "arrived" ? MapPin : Siren;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy !== null}
      className={cn(
        "flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold transition-[filter] hover:brightness-105 disabled:opacity-60",
        tone,
        confirm && "ring-4 ring-ok/30",
      )}
    >
      {busy ? <LoaderCircle className="size-5 animate-spin" /> : <Icon className="size-5" />}
      {confirm ? "Confirm — resolve alert" : next.label}
    </button>
  );
}

/** Compact horizontal progress: Sent → Received → Assigned → Arriving → Resolved. */
function Progress({ index, closed }: { index: number; closed: boolean }) {
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label="Alert progress">
      {STEPS.map((s, i) => {
        const done = i < index || (closed && i <= index);
        const current = i === index && !closed;
        return (
          <li key={s.id} className="flex flex-col items-center gap-1.5 text-center">
            <span className="flex w-full items-center">
              <span
                className={cn(
                  "h-0.5 flex-1",
                  i === 0 ? "bg-transparent" : i <= index ? "bg-ok" : "bg-line",
                )}
              />
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-bold",
                  done && "bg-ok text-ink",
                  current && "bg-accent text-ink ring-4 ring-neon-dim",
                  !done && !current && "bg-panel-2 text-dim ring-1 ring-line",
                )}
                aria-current={current ? "step" : undefined}
              >
                {done ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  "h-0.5 flex-1",
                  i === STEPS.length - 1 ? "bg-transparent" : i < index ? "bg-ok" : "bg-line",
                )}
              />
            </span>
            <span
              className={cn(
                "text-[10px] leading-tight",
                current ? "font-semibold text-fg" : "text-muted",
              )}
            >
              {s.id === "assigned" ? "Assigned" : s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ClosedNote({ alert }: { alert: SosAlert }) {
  return (
    <div className="mt-4 flex items-center gap-3 rounded-xl bg-ok/10 p-3 text-sm ring-1 ring-ok/25">
      <CheckCircle2 className="size-5 shrink-0 text-ok" />
      <span className="min-w-0 flex-1">
        {alert.status === "cancelled" ? "Cancelled" : "Resolved"}
        {alert.resolvedAt && <span className="text-muted"> · {formatClock(alert.resolvedAt)}</span>}
      </span>
      <Link to="/staff" className="text-xs font-semibold text-neon">
        Back to list
      </Link>
    </div>
  );
}
