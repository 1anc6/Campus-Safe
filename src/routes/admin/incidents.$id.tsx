import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Fact,
  Panel,
  ReplyForm,
  ResponderPicker,
  StatusButtons,
  ThreadList,
} from "@/components/admin/case-panels";
import { LiveMap } from "@/components/shared/live-map";
import { SeverityChip, StatusPill } from "@/components/shared/pills";
import { StatusStepper } from "@/components/shared/status-stepper";
import { INCIDENT_STATUSES, SEVERITIES } from "@/lib/campus";
import { listResponders } from "@/backend/functions/admin";
import {
  assignIncident,
  getIncident,
  postThread,
  staffSetIncidentStatus,
} from "@/backend/functions/reports";
import type { Incident, Responder, ThreadMessage } from "@/lib/types";
import { formatClock } from "@/lib/utils";

export const Route = createFileRoute("/admin/incidents/$id")({ component: IncidentCase });

function IncidentCase() {
  const { id } = Route.useParams();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [responders, setResponders] = useState<Responder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const d = await getIncident({ data: { id } });
    setIncident(d.incident);
    setMessages(d.messages);
  }, [id]);

  useEffect(() => {
    load().catch((e: unknown) => setError(e instanceof Error ? e.message : "Not found"));
    listResponders()
      .then(setResponders)
      .catch(() => setResponders([]));
  }, [load]);

  async function act(fn: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await fn();
      await load();
      toast.success(success);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <BackLink />
        <div className="card mt-4 p-8 text-center">
          <p className="font-display text-xl font-semibold">Incident not found</p>
          <p className="mt-1 text-sm text-muted">It may have been removed, or the link is wrong.</p>
        </div>
      </div>
    );
  }
  if (!incident) {
    return (
      <div className="space-y-3 p-4 sm:p-6" aria-busy="true">
        <BackLink />
        <div className="h-8 w-64 animate-pulse rounded bg-panel-2" />
        <div className="h-40 animate-pulse rounded-2xl bg-panel" />
      </div>
    );
  }

  const severityLabel = SEVERITIES.find((s) => s.id === incident.severity)?.label;
  const assigned = responders.find((r) => r.id === incident.assignedTo);

  return (
    <div className="p-4 sm:p-5 lg:p-6">
      <BackLink />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <SeverityChip value={incident.severity} />
        <StatusPill status={incident.status} />
        <span className="font-mono text-[11px] text-dim">#{incident.id.slice(0, 8)}</span>
      </div>
      <h1 className="mt-2 font-display text-2xl font-semibold">{incident.categoryName}</h1>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <Panel>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Fact label="Location">{incident.locationName ?? "GPS pin"}</Fact>
              <Fact label="Occurred">{formatClock(incident.occurredAt)}</Fact>
              <Fact label="Severity">
                {incident.severity} · {severityLabel}
              </Fact>
              <Fact label="Reporter">{incident.reporterName}</Fact>
            </div>
          </Panel>
          <Panel title="Description">
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {incident.description}
            </p>
            {incident.photoData && (
              <img
                src={incident.photoData}
                alt="Photo attached to the report"
                className="mt-4 max-h-72 w-full rounded-xl object-cover ring-1 ring-line"
              />
            )}
          </Panel>
          {incident.lat != null && incident.lng != null && (
            <div className="h-64 overflow-hidden rounded-2xl ring-1 ring-line">
              <LiveMap
                markers={[
                  {
                    id: incident.id,
                    lat: incident.lat,
                    lng: incident.lng,
                    kind: "incident",
                    label: incident.categoryName,
                  },
                ]}
                focus={{ lat: incident.lat, lng: incident.lng }}
                className="h-full w-full"
              />
            </div>
          )}
          <Panel title="Remarks & timeline">
            <ThreadList messages={messages} />
            <div className="mt-3">
              <ReplyForm
                onSend={async (body) => {
                  await postThread({ data: { kind: "incident", subjectId: incident.id, body } });
                  await load();
                }}
              />
            </div>
          </Panel>
        </div>

        <aside className="space-y-4">
          <Panel title="Update status">
            <StatusButtons
              current={incident.status}
              disabled={busy}
              onPick={(status) =>
                void act(
                  () => staffSetIncidentStatus({ data: { id: incident.id, status } }),
                  "Status updated",
                )
              }
            />
          </Panel>
          <Panel
            title="Assign to responder"
            actions={
              incident.assignedTo && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void act(
                      () => assignIncident({ data: { id: incident.id, responderId: null } }),
                      "Assignment cleared",
                    )
                  }
                  className="text-xs text-muted hover:text-sos"
                >
                  Clear
                </button>
              )
            }
          >
            {incident.assignedTo && (
              <p className="mb-3 text-sm">
                Assigned to{" "}
                <span className="font-medium text-neon">{assigned?.name ?? "a responder"}</span>
              </p>
            )}
            <ResponderPicker
              responders={responders}
              current={incident.assignedTo}
              disabled={busy}
              onPick={(responderId) =>
                void act(
                  () => assignIncident({ data: { id: incident.id, responderId } }),
                  "Responder assigned",
                )
              }
            />
          </Panel>
          <Panel title="Progress">
            <StatusStepper steps={INCIDENT_STATUSES} current={incident.status} />
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/admin/incidents"
      className="inline-flex min-h-10 items-center gap-1.5 text-sm text-muted hover:text-fg"
    >
      <ArrowLeft className="size-4" /> All incidents
    </Link>
  );
}
