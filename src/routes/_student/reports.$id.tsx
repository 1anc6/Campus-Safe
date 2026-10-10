import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { SeverityChip, StatusPill } from "@/components/shared/pills";
import { StatusStepper } from "@/components/shared/status-stepper";
import { INCIDENT_STATUSES } from "@/lib/campus";
import { getIncident } from "@/backend/functions/reports";
import type { Incident, ThreadMessage } from "@/lib/types";
import { formatClock } from "@/lib/utils";

export const Route = createFileRoute("/_student/reports/$id")({
  staticData: { width: "wide" },
  component: IncidentDetail,
});

const AUTHOR: Record<ThreadMessage["authorRole"], string> = {
  reporter: "You",
  admin: "Campus command",
  responder: "Responder",
  system: "Update",
};

function IncidentDetail() {
  const { id } = Route.useParams();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getIncident({ data: { id } })
      .then((r) => {
        setIncident(r.incident);
        setMessages(r.messages);
      })
      .catch(() => setError("This report could not be found."));
  }, [id]);

  return (
    <>
      <Link
        to="/reports"
        className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm text-muted hover:text-fg"
      >
        <ArrowLeft className="size-4" /> My reports
      </Link>
      {error && (
        <p className="card p-5 text-sm text-sos" role="alert">
          {error}
        </p>
      )}
      {!incident && !error && (
        <div className="h-48 animate-pulse rounded-2xl bg-panel" aria-busy="true" />
      )}
      {incident && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <SeverityChip value={incident.severity} />
              <StatusPill status={incident.status} />
            </div>
            <h1 className="mt-3 font-display text-2xl font-semibold md:text-3xl">
              {incident.categoryName}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {incident.locationName ?? "Dropped pin"} · {formatClock(incident.occurredAt)}
            </p>
            <p className="card mt-4 whitespace-pre-wrap break-words p-4 text-sm leading-relaxed">
              {incident.description}
            </p>
            {incident.photoData && (
              <img
                src={incident.photoData}
                alt="Photo you attached"
                className="mt-4 max-h-72 w-full rounded-2xl object-cover ring-1 ring-line"
              />
            )}
            <h2 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-muted">
              Updates
            </h2>
            <div className="space-y-2">
              {messages.length === 0 && <p className="text-sm text-muted">No updates yet.</p>}
              {messages.map((m) => (
                <div key={m.id} className="card p-3 text-sm">
                  <p className="text-[11px] uppercase tracking-wider text-muted">
                    {AUTHOR[m.authorRole]} · {formatClock(m.createdAt)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words">{m.body}</p>
                </div>
              ))}
            </div>
          </div>
          <aside className="card h-fit p-4 lg:sticky lg:top-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Status</p>
            <StatusStepper steps={INCIDENT_STATUSES} current={incident.status} />
          </aside>
        </div>
      )}
    </>
  );
}
