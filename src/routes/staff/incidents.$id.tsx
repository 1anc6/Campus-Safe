import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  MapPin,
  Navigation,
  PlayCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ConfidentialReporter,
  Fact,
  Panel,
  ReplyForm,
  ReporterCard,
  ThreadList,
} from "@/components/admin/case-panels";
import { LiveMap } from "@/components/shared/live-map";
import { SeverityChip, StatusPill } from "@/components/shared/pills";
import { StatusStepper } from "@/components/shared/status-stepper";
import { ResponderShell } from "@/components/responder/responder-shell";
import { SkeletonDetail } from "@/components/shared/skeleton";
import { INCIDENT_STATUSES } from "@/lib/campus";
import { directionsUrl } from "@/lib/responder";
import { getIncident, postThread, staffSetIncidentStatus } from "@/backend/functions/reports";
import type { Incident, ThreadMessage } from "@/lib/types";
import { formatClock } from "@/lib/utils";
import { useLiveUpdates } from "@/lib/use-live-updates";

export const Route = createFileRoute("/staff/incidents/$id")({ component: AssignedIncident });

/** A report command assigned to this responder's unit. */
function AssignedIncident() {
  const { id } = Route.useParams();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const d = await getIncident({ data: { id } });
    setIncident(d.incident);
    setMessages(d.messages);
  }, [id]);

  useEffect(() => {
    load().catch(() => setError("This report isn't assigned to you, or it no longer exists."));
  }, [load]);
  // Messages from command and status changes arrive as they happen; polls every
  // 10 s only while the live stream is down.
  useLiveUpdates({ kinds: ["incident"], id }, load, { fallbackMs: 10_000 });

  async function setStatus(status: "in_progress" | "resolved") {
    setBusy(true);
    try {
      await staffSetIncidentStatus({ data: { id, status } });
      await load();
      toast.success(status === "resolved" ? "Marked resolved" : "Marked in progress");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  if (!incident) {
    return (
      <ResponderShell>
        {error ? (
          <div className="grid min-h-[60dvh] place-items-center text-center text-sm">
            <div>
              <p className="text-sos">{error}</p>
              <BackLink />
            </div>
          </div>
        ) : (
          <SkeletonDetail withMap />
        )}
      </ResponderShell>
    );
  }

  const pos =
    incident.lat != null && incident.lng != null ? { lat: incident.lat, lng: incident.lng } : null;
  const open = incident.status !== "resolved" && incident.status !== "closed";

  return (
    <ResponderShell>
      <BackLink />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <SeverityChip value={incident.severity} />
        <StatusPill status={incident.status} />
      </div>
      <h1 className="mt-2 font-display text-2xl font-semibold">{incident.categoryName}</h1>
      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
        <MapPin className="size-3.5" /> {incident.locationName ?? "Dropped pin"} ·{" "}
        {formatClock(incident.occurredAt)}
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <Panel title="What was reported">
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {incident.description}
            </p>
            {incident.photoUrl && (
              <img
                src={incident.photoUrl}
                alt="Photo attached to the report"
                className="mt-4 max-h-72 w-full rounded-xl object-cover neu-raised-xs"
              />
            )}
          </Panel>
          {pos && (
            <div className="relative h-64 overflow-hidden rounded-2xl neu-raised-xs">
              <LiveMap
                markers={[
                  { id: incident.id, ...pos, kind: "incident", label: incident.categoryName },
                ]}
                focus={pos}
                className="h-full w-full"
              />
              <a
                href={directionsUrl(pos.lat, pos.lng)}
                target="_blank"
                rel="noreferrer"
                className="btn-neon absolute bottom-3 left-3 z-[500] min-h-10 px-3"
              >
                <Navigation className="size-4" /> Navigate
              </a>
            </div>
          )}
          <Panel title="Remarks & timeline">
            <ThreadList messages={messages} />
            {open && (
              <div className="mt-3">
                <ReplyForm
                  placeholder="Add a field note for command"
                  onSend={async (body) => {
                    await postThread({ data: { kind: "incident", subjectId: id, body } });
                    await load();
                  }}
                />
              </div>
            )}
          </Panel>
        </div>

        <aside className="space-y-4">
          <Panel>
            {incident.reporter ? (
              <ReporterCard reporter={incident.reporter} />
            ) : incident.visibility === "confidential" ? (
              <ConfidentialReporter />
            ) : (
              <Fact label="Reporter">{incident.reporterName}</Fact>
            )}
          </Panel>
          {open && (
            <Panel title="Update">
              <div className="grid gap-2">
                {incident.status !== "in_progress" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void setStatus("in_progress")}
                    className="btn-ghost"
                  >
                    {busy ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <PlayCircle className="size-4" />
                    )}
                    I&apos;m on it
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void setStatus("resolved")}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-ok text-sm font-semibold text-ink disabled:opacity-50"
                >
                  <CheckCircle2 className="size-4" /> Mark resolved
                </button>
              </div>
              <p className="mt-2 text-xs text-dim">Command closes the case after review.</p>
            </Panel>
          )}
          <Panel title="Progress">
            <StatusStepper steps={INCIDENT_STATUSES} current={incident.status} />
          </Panel>
        </aside>
      </div>
    </ResponderShell>
  );
}

function BackLink() {
  return (
    <Link
      to="/staff"
      className="inline-flex min-h-10 items-center gap-1.5 text-sm text-muted hover:text-fg"
    >
      <ArrowLeft className="size-4" /> Assigned work
    </Link>
  );
}
