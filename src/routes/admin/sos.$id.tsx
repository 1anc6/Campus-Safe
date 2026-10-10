import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Phone } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Fact,
  Panel,
  ReplyForm,
  ResponderPicker,
  ThreadList,
} from "@/components/admin/case-panels";
import { LiveMap } from "@/components/shared/live-map";
import { MedicalCard } from "@/components/shared/medical-card";
import { StatusPill } from "@/components/shared/pills";
import { StatusStepper } from "@/components/shared/status-stepper";
import { SOS_STEPS } from "@/lib/campus";
import { listResponders } from "@/backend/functions/admin";
import { postThread } from "@/backend/functions/reports";
import { assignSos, getSos, setSosStatus } from "@/backend/functions/sos";
import type { Responder, SosAlert, SosPoint, ThreadMessage } from "@/lib/types";
import { formatClock, waitLabel } from "@/lib/utils";

export const Route = createFileRoute("/admin/sos/$id")({ component: SosCase });

function SosCase() {
  const { id } = Route.useParams();
  const [alert, setAlert] = useState<SosAlert | null>(null);
  const [trail, setTrail] = useState<SosPoint[]>([]);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [responders, setResponders] = useState<Responder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const d = await getSos({ data: { id } });
    setAlert(d.alert);
    setTrail(d.trail);
    setMessages(d.messages);
  }, [id]);

  useEffect(() => {
    load().catch((e: unknown) => setError(e instanceof Error ? e.message : "Not found"));
    listResponders()
      .then(setResponders)
      .catch(() => setResponders([]));
    const poll = window.setInterval(() => void load().catch(() => {}), 5000);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
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
          <p className="font-display text-xl font-semibold">Alert not found</p>
        </div>
      </div>
    );
  }
  if (!alert) {
    return (
      <div className="space-y-3 p-4 sm:p-6" aria-busy="true">
        <BackLink />
        <div className="h-72 animate-pulse rounded-2xl bg-panel" />
      </div>
    );
  }

  const closed = alert.status === "resolved" || alert.status === "cancelled";
  const pos = alert.lat != null && alert.lng != null ? { lat: alert.lat, lng: alert.lng } : null;

  return (
    <div className="p-4 sm:p-5 lg:p-6">
      <BackLink />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-sos/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-sos">
          SOS
        </span>
        <StatusPill status={alert.status} />
        {!closed && (
          <span className="font-mono text-xs text-muted">
            waiting {waitLabel(alert.startedAt, now)}
          </span>
        )}
      </div>
      <h1 className="mt-2 font-display text-2xl font-semibold">{alert.reporterName}</h1>
      {alert.notes && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-warn/15 px-3 py-1 text-xs font-semibold text-warn">
          Auto-raised: {alert.notes}
        </p>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <div className="h-72 overflow-hidden rounded-2xl ring-1 ring-line sm:h-96">
            <LiveMap
              markers={
                pos ? [{ id: alert.id, ...pos, kind: "sos", label: alert.reporterName }] : []
              }
              trail={trail}
              focus={pos}
              className="h-full w-full"
            />
          </div>
          <Panel>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Fact label="Started">{formatClock(alert.startedAt)}</Fact>
              <Fact label="Fix">
                {alert.isApproximate ? "Approximate" : "Live GPS"}
                {alert.accuracyM != null && ` · ±${Math.round(alert.accuracyM)}m`}
              </Fact>
              <Fact label="Responder">{alert.assignedName ?? "Unassigned"}</Fact>
              <Fact label="Trail points">{trail.length}</Fact>
            </div>
            <MedicalCard info={alert.reporterMedical} className="mt-4" />
            {alert.reporterPhone && (
              <a href={`tel:${alert.reporterPhone}`} className="btn-ghost mt-4 text-neon">
                <Phone className="size-4" /> Call {alert.reporterPhone}
              </a>
            )}
          </Panel>
          <Panel title="Timeline">
            <ThreadList messages={messages} />
            <div className="mt-3">
              <ReplyForm
                onSend={async (body) => {
                  await postThread({ data: { kind: "sos", subjectId: alert.id, body } });
                  await load();
                }}
              />
            </div>
          </Panel>
        </div>

        <aside className="space-y-4">
          <Panel title="Dispatch">
            {closed ? (
              <p className="text-sm text-muted">This alert is closed.</p>
            ) : (
              <>
                <ResponderPicker
                  responders={responders}
                  current={alert.assignedTo}
                  disabled={busy}
                  onPick={(responderId) =>
                    void act(
                      () => assignSos({ data: { id: alert.id, responderId } }),
                      "Responder assigned",
                    )
                  }
                />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void act(
                        () => setSosStatus({ data: { id: alert.id, status: "arrived" } }),
                        "Marked arrived",
                      )
                    }
                    className="btn-ghost"
                  >
                    Arrived
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void act(
                        () => setSosStatus({ data: { id: alert.id, status: "resolved" } }),
                        "SOS resolved",
                      )
                    }
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-ok text-sm font-semibold text-ink disabled:opacity-50"
                  >
                    Resolve
                  </button>
                </div>
              </>
            )}
          </Panel>
          <Panel title="Progress">
            <StatusStepper
              steps={SOS_STEPS.filter((s) => s.id !== "cancelled")}
              current={alert.status}
            />
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/admin/sos"
      className="inline-flex min-h-10 items-center gap-1.5 text-sm text-muted hover:text-fg"
    >
      <ArrowLeft className="size-4" /> SOS alerts
    </Link>
  );
}
