import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  Inbox,
  MapPinned,
  Phone,
  Siren,
  Timer,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ReplyForm,
  ResponderPicker,
  StatusButtons,
  ThreadList,
} from "@/components/admin/case-panels";
import { DashCard as Card } from "@/components/admin/dash-card";
import { CategoryDonut, DailyBars, HotspotBars } from "@/components/shared/charts";
import { KindChip, SeverityChip, StatusPill } from "@/components/shared/pills";
import { INCIDENT_STATUSES, SOS_STEPS } from "@/lib/campus";
import { getLive, listAnonymousAdmin } from "@/backend/functions/admin";
import {
  getIncident,
  postThread,
  staffSetAnonymousStatus,
  staffSetIncidentStatus,
  trackAnonymous,
} from "@/backend/functions/reports";
import { assignSos, getSos, setSosStatus } from "@/backend/functions/sos";
import type { LivePayload, QueueItem, SosAlert, ThreadMessage } from "@/lib/types";
import { cn, formatClock, waitLabel } from "@/lib/utils";
import { SkeletonList } from "@/components/shared/skeleton";

export const Route = createFileRoute("/admin/")({ component: Command });

type Range = "today" | "week" | "month";
type KindFilter = "all" | QueueItem["kind"];

const KIND_FILTERS: { id: KindFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "sos", label: "SOS" },
  { id: "incident", label: "Incidents" },
  { id: "anonymous", label: "Anonymous" },
];

const SEVERITY_BAR: Record<QueueItem["severity"], string> = {
  P1: "bg-sos",
  P2: "bg-high",
  P3: "bg-warn",
  P4: "bg-ok",
};

function Command() {
  const [live, setLive] = useState<LivePayload | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<QueueItem | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [range, setRange] = useState<Range>("week");
  const [kind, setKind] = useState<KindFilter>("all");
  const prevSos = useRef<string[] | null>(null);
  const audio = useRef<AudioContext | null>(null);

  const flashAndBeep = useCallback(() => {
    document.documentElement.classList.add("sos-flash");
    window.setTimeout(() => document.documentElement.classList.remove("sos-flash"), 2400);
    try {
      audio.current ??= new AudioContext();
      const ctx = audio.current;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.value = 0.04;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.18);
    } catch {
      /* audio unavailable (autoplay policy) — the visual flash still fires */
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const d = await getLive();
      setLive(d);
      setLoadError(false);
      setUpdatedAt(Date.now());
      const ids = d.sos.map((s) => s.id);
      const incoming = prevSos.current ? ids.filter((id) => !prevSos.current!.includes(id)) : [];
      if (incoming.length) {
        flashAndBeep();
        const first = d.queue.find((q) => q.kind === "sos" && incoming.includes(q.id));
        if (first) setSelected(first);
      }
      prevSos.current = ids;
      // Keep the selection in sync with fresh queue data (status changes).
      setSelected((cur) =>
        cur
          ? (d.queue.find((q) => q.kind === cur.kind && q.id === cur.id) ?? cur)
          : (d.queue[0] ?? null),
      );
    } catch {
      setLoadError(true);
    }
  }, [flashAndBeep]);

  useEffect(() => {
    void refresh();
    const p = window.setInterval(() => void refresh(), 5000);
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(p);
      window.clearInterval(t);
    };
  }, [refresh]);

  const queue = useMemo(
    () => (live?.queue ?? []).filter((q) => kind === "all" || q.kind === kind),
    [live, kind],
  );
  const daily = live?.daily ?? [];
  const sliced = range === "today" ? daily.slice(-1) : range === "week" ? daily.slice(-7) : daily;
  const c = live?.counters;

  return (
    <div className="space-y-5 p-4 sm:p-5 lg:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Command dashboard</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted">
            <span
              className={cn("size-2 rounded-full", loadError ? "bg-sos" : "pulse-dot bg-ok")}
              aria-hidden="true"
            />
            {loadError
              ? "Live feed interrupted — retrying every 5 seconds"
              : updatedAt
                ? `Live · updated ${waitLabel(new Date(updatedAt).toISOString(), now)} ago`
                : "Connecting to live feed…"}
          </p>
        </div>
        <Link to="/admin/sos" className="btn-ghost self-start sm:self-auto">
          <MapPinned className="size-4 text-neon" /> SOS map
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          icon={Siren}
          tone="sos"
          label="Active SOS"
          value={c?.activeSos}
          hint="Live alerts"
          alert={(c?.activeSos ?? 0) > 0}
        />
        <Kpi icon={Inbox} tone="neon" label="New" value={c?.incoming} hint="Awaiting triage" />
        <Kpi
          icon={Timer}
          tone="warn"
          label="In progress"
          value={c?.inProgress}
          hint="Being handled"
        />
        <Kpi
          icon={CheckCircle2}
          tone="ok"
          label="Resolved today"
          value={c?.resolvedToday}
          hint={live ? `${live.avgResponseMin}m avg SOS response` : "—"}
        />
      </div>

      <div className="grid gap-4 lg:h-[620px] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card
          title="Live queue"
          badge={live ? String(live.queue.length) : undefined}
          bodyClassName="max-h-[420px] lg:max-h-none"
          toolbar={
            <div className="seg w-full [&>button]:flex-1" role="group" aria-label="Filter queue">
              {KIND_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={kind === f.id}
                  onClick={() => setKind(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          }
        >
          {!live && !loadError && <QueueSkeleton />}
          {live && queue.length === 0 && (
            <p className="px-2 py-10 text-center text-sm text-muted">
              Nothing waiting here. Queue is clear.
            </p>
          )}
          <ul className="space-y-1.5">
            {queue.map((q) => {
              const on = selected?.id === q.id && selected.kind === q.kind;
              return (
                <li key={`${q.kind}-${q.id}`}>
                  <button
                    type="button"
                    onClick={() => setSelected(q)}
                    aria-pressed={on}
                    className={cn(
                      "relative flex w-full items-center gap-3 overflow-hidden rounded-xl py-3 pl-4 pr-3 text-left ring-1 transition-colors",
                      on ? "bg-panel-2 ring-neon/40" : "ring-transparent hover:bg-panel-2/60",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute inset-y-2 left-1.5 w-1 rounded-full",
                        SEVERITY_BAR[q.severity],
                      )}
                      aria-hidden="true"
                    />
                    <KindChip kind={q.kind} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{q.title}</p>
                      <p className="truncate text-xs text-muted">
                        {q.place}
                        {q.agedTo && (
                          <span
                            className="ml-1.5 font-semibold text-warn"
                            title="Waiting a long time, so its priority was raised (aging)"
                          >
                            · aged {q.severity}→{q.agedTo}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <SeverityChip value={q.severity} />
                      <span className="font-mono text-[11px] tabular-nums text-dim">
                        {waitLabel(q.startedAt, now)}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title="Case" actions={selected && <OpenCaseLink item={selected} />}>
          {selected ? (
            <Detail
              key={`${selected.kind}-${selected.id}`}
              item={selected}
              responders={live?.responders ?? []}
              onChange={() => void refresh()}
            />
          ) : (
            <p className="px-2 py-10 text-center text-sm text-muted">
              Select an item in the queue to manage it.
            </p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card
          title="Volume"
          className="md:col-span-2 xl:col-span-1"
          actions={
            <div className="seg [&>button]:px-2.5 [&>button]:py-1" role="group" aria-label="Range">
              {(["today", "week", "month"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={range === r}
                  onClick={() => setRange(r)}
                >
                  {r === "today" ? "Today" : r === "week" ? "Week" : "Month"}
                </button>
              ))}
            </div>
          }
        >
          <DailyBars data={sliced} />
        </Card>
        <Card title="Hotspots">
          <HotspotBars data={live?.hotspots ?? []} />
        </Card>
        <Card title="Categories">
          <CategoryDonut data={live?.categories ?? []} />
        </Card>
      </div>
    </div>
  );
}

const KPI_TONE = {
  sos: "bg-sos/12 text-sos",
  neon: "bg-neon-dim text-neon",
  warn: "bg-warn/12 text-warn",
  ok: "bg-ok/12 text-ok",
} as const;

function Kpi({
  icon: Icon,
  tone,
  label,
  value,
  hint,
  alert,
}: {
  icon: typeof Siren;
  tone: keyof typeof KPI_TONE;
  label: string;
  value: number | undefined;
  hint: string;
  alert?: boolean;
}) {
  return (
    <div
      className={cn(
        "card flex min-w-0 flex-col items-start gap-2.5 p-3.5 sm:flex-row sm:items-center sm:gap-3 sm:p-4",
        alert && "ring-1 ring-sos/40",
      )}
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-xl sm:size-11",
          KPI_TONE[tone],
        )}
      >
        <Icon className="size-4 sm:size-5" />
      </span>
      <div className="w-full min-w-0">
        <p className="truncate text-xs text-muted">{label}</p>
        <p
          className={cn(
            "font-display text-2xl font-bold tabular-nums leading-tight",
            alert ? "text-sos" : "text-fg",
          )}
        >
          {value ?? "–"}
        </p>
        <p className="truncate text-[11px] text-dim">{hint}</p>
      </div>
    </div>
  );
}

function QueueSkeleton() {
  return <SkeletonList rows={6} className="space-y-1.5" />;
}

function OpenCaseLink({ item }: { item: QueueItem }) {
  const cls =
    "inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs text-neon hover:bg-panel-2";
  const body = (
    <>
      Open full case <ArrowUpRight className="size-3.5" />
    </>
  );
  if (item.kind === "sos") {
    return (
      <Link to="/admin/sos/$id" params={{ id: item.id }} className={cls}>
        {body}
      </Link>
    );
  }
  if (item.kind === "incident") {
    return (
      <Link to="/admin/incidents/$id" params={{ id: item.id }} className={cls}>
        {body}
      </Link>
    );
  }
  return (
    <Link to="/admin/anonymous" className={cls}>
      {body}
    </Link>
  );
}

/** Compact horizontal progress track (keeps actions above the fold). */
function StepTrack({
  steps,
  current,
}: {
  steps: { id: string; label: string }[];
  current: string;
}) {
  const idx = Math.max(
    0,
    steps.findIndex((s) => s.id === current),
  );
  const finished = current === "resolved" || current === "closed";
  return (
    <ol className="grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((s, i) => {
        const done = i < idx || (finished && i <= idx);
        const active = i === idx && !finished;
        return (
          <li key={s.id} className="relative flex flex-col items-center gap-1.5 text-center">
            {i > 0 && (
              <span
                className={cn(
                  "absolute right-1/2 top-3 h-px w-full -translate-y-1/2",
                  i <= idx ? "bg-neon/50" : "bg-line",
                )}
                aria-hidden="true"
              />
            )}
            <span
              className={cn(
                "relative z-10 grid size-6 place-items-center rounded-full text-[10px] font-bold",
                done
                  ? "bg-ok text-ink"
                  : active
                    ? "bg-accent text-ink"
                    : "bg-panel-2 text-muted ring-1 ring-line",
              )}
            >
              {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <span
              className={cn(
                "px-0.5 text-[10px] leading-tight sm:text-[11px]",
                done || active ? "text-fg" : "text-dim",
              )}
            >
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
      {children}
    </h3>
  );
}

function Detail({
  item,
  responders,
  onChange,
}: {
  item: QueueItem;
  responders: LivePayload["responders"];
  onChange: () => void;
}) {
  const [sos, setSos] = useState<SosAlert | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [desc, setDesc] = useState("");
  const [anonCode, setAnonCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (item.kind === "sos") {
      const d = await getSos({ data: { id: item.id } });
      setSos(d.alert);
      setMessages(d.messages);
    } else if (item.kind === "incident") {
      const d = await getIncident({ data: { id: item.id } });
      setMessages(d.messages);
      setDesc(d.incident.description);
    } else {
      const row = (await listAnonymousAdmin()).find((r) => r.id === item.id);
      setDesc(row?.description ?? "");
      setAnonCode(row?.trackingCode ?? null);
      if (row?.trackingCode) {
        const t = await trackAnonymous({ data: { code: row.trackingCode } });
        setMessages(t.messages);
      }
    }
  }, [item.id, item.kind]);

  useEffect(() => {
    void load().catch(() => toast.error("Could not load this case"));
  }, [load]);

  async function act(fn: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      onChange();
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 px-1">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <KindChip kind={item.kind} />
          <SeverityChip value={item.severity} />
          <StatusPill status={item.status} />
          {item.agedTo && (
            <span className="text-xs font-semibold text-warn">
              Aged to {item.agedTo} (waiting long)
            </span>
          )}
        </div>
        <h2 className="mt-2.5 font-display text-xl font-semibold">{item.title}</h2>
        <p className="mt-0.5 text-sm text-muted">
          {item.place} · {formatClock(item.startedAt)}
        </p>
      </div>

      {sos && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-panel-2/60 p-3 ring-1 ring-line">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-dim">Reporter</p>
            <p className="truncate font-medium">{sos.reporterName}</p>
            {sos.reporterPhone && <p className="text-xs text-muted">{sos.reporterPhone}</p>}
          </div>
          {sos.reporterPhone && (
            <a href={`tel:${sos.reporterPhone}`} className="btn-ghost min-h-10 px-3 text-neon">
              <Phone className="size-3.5" /> Call
            </a>
          )}
        </div>
      )}
      {item.kind === "anonymous" && (
        <p className="rounded-xl bg-violet/10 p-3 text-sm text-violet ring-1 ring-violet/25">
          Reporter is anonymous. Replies route through{" "}
          <span className="font-mono">{anonCode ?? "the tracking code"}</span>.
        </p>
      )}
      {desc && (
        <p className="rounded-xl bg-panel-2/40 p-3 text-sm leading-relaxed text-fg ring-1 ring-line">
          {desc}
        </p>
      )}

      <section>
        <SectionLabel>Progress</SectionLabel>
        <StepTrack
          steps={
            item.kind === "sos" ? SOS_STEPS.filter((s) => s.id !== "cancelled") : INCIDENT_STATUSES
          }
          current={item.status}
        />
      </section>

      {item.kind === "sos" ? (
        <section>
          <SectionLabel>Dispatch</SectionLabel>
          <ResponderPicker
            forSos
            responders={responders}
            current={sos?.assignedTo ?? null}
            disabled={busy}
            onPick={(id) =>
              void act(
                () => assignSos({ data: { id: item.id, responderId: id } }),
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
                  () => setSosStatus({ data: { id: item.id, status: "arrived" } }),
                  "Marked arrived",
                )
              }
              className="btn-ghost"
            >
              Mark arrived
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void act(
                  () => setSosStatus({ data: { id: item.id, status: "resolved" } }),
                  "SOS resolved",
                )
              }
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-ok text-sm font-semibold text-ink disabled:opacity-50"
            >
              Resolve
            </button>
          </div>
        </section>
      ) : (
        <section>
          <SectionLabel>Update status</SectionLabel>
          <StatusButtons
            current={item.status}
            disabled={busy}
            onPick={(status) => {
              const fn =
                item.kind === "incident" ? staffSetIncidentStatus : staffSetAnonymousStatus;
              void act(() => fn({ data: { id: item.id, status } }), "Status updated");
            }}
          />
        </section>
      )}

      <section>
        <SectionLabel>Timeline</SectionLabel>
        <ThreadList messages={messages} />
        <div className="mt-3">
          <ReplyForm
            placeholder={item.kind === "anonymous" ? "Reply via tracking code" : "Add a remark"}
            onSend={async (body) => {
              await postThread({ data: { kind: item.kind, subjectId: item.id, body } });
              await load();
            }}
          />
        </div>
      </section>
    </div>
  );
}
