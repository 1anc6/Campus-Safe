import { createFileRoute } from "@tanstack/react-router";
import { Info, LoaderCircle, Megaphone, Send, TriangleAlert, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import {
  createCampusAlert,
  endCampusAlert,
  listCampusAlertsAdmin,
  type AlertLevel,
  type CampusAlertAdmin,
} from "@/backend/functions/alerts";
import { cn, formatClock } from "@/lib/utils";
import { SkeletonList } from "@/components/shared/skeleton";

export const Route = createFileRoute("/admin/alerts")({ component: BroadcastsPage });

const LEVELS: { id: AlertLevel; label: string; icon: typeof Info; tone: string }[] = [
  { id: "info", label: "Notice", icon: Info, tone: "text-neon" },
  { id: "warning", label: "Warning", icon: Megaphone, tone: "text-warn" },
  { id: "critical", label: "Urgent", icon: TriangleAlert, tone: "text-sos" },
];

const DURATIONS: { hours: number | null; label: string }[] = [
  { hours: 1, label: "1 hour" },
  { hours: 6, label: "6 hours" },
  { hours: 24, label: "1 day" },
  { hours: null, label: "Until ended" },
];

function BroadcastsPage() {
  const [data, setData] = useState<{ students: number; alerts: CampusAlertAdmin[] } | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [level, setLevel] = useState<AlertLevel>("warning");
  const [hours, setHours] = useState<number | null>(6);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await listCampusAlertsAdmin());
    } catch {
      toast.error("Couldn't load broadcasts");
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 10_000);
    return () => window.clearInterval(t);
  }, [load]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 3) return toast("Add a short title");
    if (body.trim().length < 3) return toast("Add the message");
    setSending(true);
    try {
      await createCampusAlert({ data: { title: title.trim(), body: body.trim(), level, hours } });
      toast.success("Broadcast sent to every student");
      setTitle("");
      setBody("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send");
    } finally {
      setSending(false);
    }
  }

  const live = data?.alerts.filter((a) => a.live) ?? [];
  const past = data?.alerts.filter((a) => !a.live) ?? [];

  return (
    <div className="space-y-5 p-4 sm:p-5 lg:p-6">
      <AdminPageHeader
        title="Broadcasts"
        subtitle="Send a campus-wide alert. Every student sees it at the top of their app until they tap “Got it”."
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <form
          onSubmit={(e) => void send(e)}
          className="card space-y-4 p-5"
          aria-label="New broadcast"
        >
          <h2 className="text-sm font-semibold">New broadcast</h2>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Level">
            {LEVELS.map((l) => (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={level === l.id}
                onClick={() => setLevel(l.id)}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-semibold ring-1 transition-colors",
                  level === l.id
                    ? "text-neon ring-transparent shadow-[var(--neu-inset-sm)]"
                    : "text-muted ring-transparent shadow-[var(--neu-raised-xs)] hover:shadow-[var(--neu-raised-sm)] hover:text-fg",
                )}
              >
                <l.icon className={cn("size-4", l.tone)} /> {l.label}
              </button>
            ))}
          </div>
          <div>
            <label htmlFor="bc-title" className="field-label">
              Title
            </label>
            <input
              id="bc-title"
              className="input"
              maxLength={80}
              placeholder="e.g. Avoid Gate 2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="bc-body" className="field-label">
              Message
            </label>
            <textarea
              id="bc-body"
              className="input min-h-24 resize-y"
              maxLength={500}
              placeholder="e.g. Fire drill in progress until 4 pm. Use Gate 1."
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <div>
            <p className="field-label">Show for</p>
            <div className="seg w-full [&>button]:flex-1" role="group" aria-label="Show for">
              {DURATIONS.map((d) => (
                <button
                  key={d.label}
                  type="button"
                  aria-pressed={hours === d.hours}
                  onClick={() => setHours(d.hours)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" disabled={sending} className="btn-neon w-full">
            {sending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            SEND TO ALL STUDENTS
          </button>
        </form>

        <div className="space-y-5">
          <section className="card p-5">
            <h2 className="text-sm font-semibold">Live now</h2>
            {data === null ? (
              <SkeletonList rows={1} className="mt-3" />
            ) : live.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No broadcast is showing right now.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {live.map((a) => (
                  <AlertRow key={a.id} alert={a} students={data.students} onEnd={load} />
                ))}
              </ul>
            )}
          </section>
          {past.length > 0 && (
            <section className="card p-5">
              <h2 className="text-sm font-semibold">Earlier</h2>
              <ul className="mt-3 space-y-2">
                {past.map((a) => (
                  <AlertRow key={a.id} alert={a} students={data?.students ?? 0} />
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function AlertRow({
  alert,
  students,
  onEnd,
}: {
  alert: CampusAlertAdmin;
  students: number;
  onEnd?: () => Promise<void>;
}) {
  const L = LEVELS.find((l) => l.id === alert.level)!;
  const pct = students ? Math.min(100, Math.round((alert.seenCount / students) * 100)) : 0;
  const [ending, setEnding] = useState(false);
  return (
    <li className={cn("rounded-2xl p-3.5 neu-well", !alert.live && "opacity-70")}>
      <div className="flex items-start gap-3">
        <L.icon className={cn("mt-0.5 size-4 shrink-0", L.tone)} />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{alert.title}</p>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted">{alert.body}</p>
          <p className="mt-1 text-[11px] text-dim">
            {alert.createdByName} · {formatClock(alert.createdAt)}
            {alert.live
              ? alert.expiresAt
                ? ` · until ${formatClock(alert.expiresAt)}`
                : " · until ended"
              : alert.endedAt
                ? ` · ended ${formatClock(alert.endedAt)}`
                : " · expired"}
          </p>
        </div>
        {alert.live && onEnd && (
          <button
            type="button"
            disabled={ending}
            onClick={() => {
              setEnding(true);
              void endCampusAlert({ data: { id: alert.id } })
                .then(onEnd)
                .catch(() => toast.error("Couldn't end it"))
                .finally(() => setEnding(false));
            }}
            className="btn-ghost h-9 shrink-0 px-3 text-xs"
          >
            <X className="size-3.5" /> End
          </button>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-3">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="shrink-0 text-[11px] tabular-nums text-muted">
          Seen by {alert.seenCount} of {students} ({pct}%)
        </span>
      </div>
    </li>
  );
}
