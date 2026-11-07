import { useState, type ReactNode } from "react";
import { EyeOff, LoaderCircle, Lock, Mail, Phone, Send } from "lucide-react";
import { Avatar } from "@/components/shared/account-menu";
import { INCIDENT_STATUSES, type IncidentStatus } from "@/lib/campus";
import { MAX_ACTIVE_SOS_PER_RESPONDER, hasFreeSlot, pickResponder } from "@/lib/scheduling";
import type { IncidentReporter, Responder, ReporterView, ThreadMessage } from "@/lib/types";
import { cn, formatClock } from "@/lib/utils";

/** Titled panel used across the admin case views. */
export function Panel({
  title,
  children,
  className,
  actions,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={cn("card p-4", className)}>
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && (
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h2>
          )}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const AUTHOR_LABEL: Record<ThreadMessage["authorRole"], string> = {
  reporter: "Reporter",
  admin: "Command",
  responder: "Responder",
  system: "System",
};

/** Case timeline: system events, command remarks, reporter replies. */
export function ThreadList({
  messages,
  empty = "No activity yet.",
}: {
  messages: ThreadMessage[];
  empty?: string;
}) {
  if (messages.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ol className="space-y-2">
      {messages.map((m) => (
        <li
          key={m.id}
          className={cn(
            "rounded-lg p-3 text-sm neu-raised-xs",
            m.authorRole === "system" ? "bg-chrome/60 text-muted" : "bg-panel-2",
          )}
        >
          <p className="text-[11px] uppercase tracking-wider text-dim">
            {AUTHOR_LABEL[m.authorRole]} · {formatClock(m.createdAt)}
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words">{m.body}</p>
        </li>
      ))}
    </ol>
  );
}

/** Remark / reply composer. Keeps the draft if sending fails. */
export function ReplyForm({
  onSend,
  placeholder = "Add a remark",
}: {
  onSend: (body: string) => Promise<unknown>;
  placeholder?: string;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const text = body.trim();
        if (!text || busy) return;
        setBusy(true);
        setError(null);
        onSend(text)
          .then(() => setBody(""))
          .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not send"))
          .finally(() => setBusy(false));
      }}
      className="space-y-1.5"
    >
      <div className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={placeholder}
          maxLength={1000}
          className="input flex-1"
          aria-label={placeholder}
        />
        <button
          type="submit"
          disabled={busy || !body.trim()}
          className="btn-neon px-4"
          aria-label="Send"
        >
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-sos">{error}</p>}
    </form>
  );
}

const UNIT_STATUS: Record<Responder["status"], string> = {
  available: "text-ok",
  on_duty: "text-warn",
  off_duty: "text-dim",
};

/** Pick a responder unit; highlights the current assignment. */
export function ResponderPicker({
  responders,
  current,
  onPick,
  disabled,
  forSos = false,
}: {
  responders: Responder[];
  current: string | null;
  onPick: (id: string) => void;
  disabled?: boolean;
  /**
   * SOS assignment: show each unit's live load, block full units (counting
   * semaphore) and mark the load-balanced suggestion (lib/scheduling.ts).
   */
  forSos?: boolean;
}) {
  if (responders.length === 0) return <p className="text-sm text-muted">No responder units yet.</p>;
  const suggested = forSos && !current ? pickResponder(responders) : null;
  return (
    <div className="space-y-2">
      {forSos && !current && (
        <p className="text-xs text-muted">
          {suggested ? (
            <>
              Suggested: <span className="font-semibold text-fg">{suggested.name}</span> (least
              busy, then longest since last alert)
            </>
          ) : (
            <>Every unit is full or off duty. Resolve an alert to free a slot.</>
          )}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {responders.map((r) => {
          const on = r.id === current;
          const full = forSos && !on && !hasFreeSlot(r);
          return (
            <button
              key={r.id}
              type="button"
              disabled={disabled || full}
              onClick={() => onPick(r.id)}
              aria-pressed={on}
              title={full ? `${r.name} is full or off duty` : undefined}
              className={cn(
                "min-h-10 rounded-full px-3 text-xs font-semibold ring-1 transition-colors disabled:opacity-50",
                on
                  ? "text-neon ring-transparent shadow-[var(--neu-inset-sm)]"
                  : r.id === suggested?.id
                    ? "ring-2 ring-accent shadow-[var(--neu-raised-xs)]"
                    : "ring-transparent shadow-[var(--neu-raised-xs)] hover:shadow-[var(--neu-raised-sm)]",
              )}
            >
              {r.name}
              <span className={cn("ml-1.5 font-normal", on ? "text-muted" : UNIT_STATUS[r.status])}>
                · {r.unit}
              </span>
              {forSos && (
                <span className="ml-1.5 font-normal tabular-nums text-muted">
                  {r.activeSos}/{MAX_ACTIVE_SOS_PER_RESPONDER}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Incident / anonymous report status selector. */
export function StatusButtons({
  current,
  onPick,
  disabled,
}: {
  current: string;
  onPick: (status: IncidentStatus) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {INCIDENT_STATUSES.map((s) => {
        const on = s.id === current;
        return (
          <button
            key={s.id}
            type="button"
            disabled={disabled || on}
            onClick={() => onPick(s.id)}
            aria-pressed={on}
            className={cn(
              "min-h-9 rounded-full px-3 text-[11px] font-medium ring-1 transition-colors",
              on
                ? "text-neon ring-transparent shadow-[var(--neu-inset-sm)]"
                : "ring-transparent shadow-[var(--neu-raised-xs)] hover:shadow-[var(--neu-raised-sm)] disabled:opacity-50",
            )}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

/** Label/value row for case facts. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wider text-dim">{label}</p>
      <div className="mt-0.5 truncate text-sm text-fg">{children}</div>
    </div>
  );
}

/** Who filed an identified report: command needs to know, and to be able to reach them. */
export function ReporterCard({
  reporter,
  confidential,
}: {
  reporter: IncidentReporter;
  /** Filed as confidential: command sees this card, the assigned responder does not. */
  confidential?: boolean;
}) {
  const detail = [reporter.studentId && `ID ${reporter.studentId}`, reporter.course]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="rounded-xl p-3 neu-well">
      <p className="text-[11px] uppercase tracking-wider text-dim">Reported by</p>
      {confidential && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-warn/10 px-2.5 py-2 text-xs text-warn ring-1 ring-warn/25">
          <Lock className="mt-px size-3.5 shrink-0" />
          Confidential. Only command sees this. Don&apos;t share it with the field unit.
        </p>
      )}
      <div className="mt-2 flex items-center gap-3">
        <Avatar
          profile={{ ...reporter, userId: "", role: "student" }}
          className="size-10 text-sm"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{reporter.name}</p>
          <p className="truncate text-xs text-muted">{detail || "No student ID on file"}</p>
        </div>
      </div>
      {(reporter.email || reporter.phone) && (
        <dl className="mt-3 space-y-1 text-xs">
          {reporter.email && (
            <div className="flex gap-2">
              <dt className="w-12 shrink-0 text-dim">Email</dt>
              <dd className="min-w-0 truncate text-fg">{reporter.email}</dd>
            </div>
          )}
          {reporter.phone && (
            <div className="flex gap-2">
              <dt className="w-12 shrink-0 text-dim">Phone</dt>
              <dd className="min-w-0 truncate font-mono text-fg">{reporter.phone}</dd>
            </div>
          )}
        </dl>
      )}
      {(reporter.email || reporter.phone) && (
        <div className="mt-3 flex gap-2">
          {reporter.phone && (
            <a href={`tel:${reporter.phone}`} className="btn-ghost min-h-10 flex-1 px-3 text-neon">
              <Phone className="size-3.5" /> Call
            </a>
          )}
          {reporter.email && (
            <a href={`mailto:${reporter.email}`} className="btn-ghost min-h-10 flex-1 px-3">
              <Mail className="size-3.5" /> Email
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/** Stand-in for ReporterCard on anonymous reports: there is no identity to show. */
export function AnonymousReporter({ code }: { code: string | null }) {
  return (
    <div className="flex gap-3 rounded-xl bg-violet/10 p-3 ring-1 ring-violet/25">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-violet/15">
        <EyeOff className="size-4 text-violet" />
      </span>
      <div className="min-w-0 text-sm">
        <p className="font-medium text-violet">Anonymous reporter</p>
        <p className="mt-0.5 text-xs text-muted">
          Filed without an account, so no name or contact details were ever collected. Replies reach
          them through tracking code <span className="font-mono text-violet">{code ?? "…"}</span>.
        </p>
      </div>
    </div>
  );
}

/** Accountability: who on staff has opened this reporter's details, from the audit log. */
export function ReporterViews({ views }: { views: ReporterView[] }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-dim">Reporter details viewed by</p>
      {views.length === 0 ? (
        <p className="mt-1.5 text-xs text-muted">No one yet.</p>
      ) : (
        <ul className="mt-1.5 space-y-1 text-xs">
          {views.map((v) => (
            <li key={`${v.name}-${v.at}`} className="flex justify-between gap-3">
              <span className="truncate text-fg">{v.name}</span>
              <span className="shrink-0 text-dim">{formatClock(v.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Field app stand-in for ReporterCard on a confidential case. */
export function ConfidentialReporter() {
  return (
    <div className="flex gap-3 rounded-xl bg-warn/10 p-3 ring-1 ring-warn/25">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-warn/15">
        <Lock className="size-4 text-warn" />
      </span>
      <div className="min-w-0 text-sm">
        <p className="font-medium text-warn">Confidential reporter</p>
        <p className="mt-0.5 text-xs text-muted">
          The student asked that only command know who they are. Ask command if you need to reach
          them.
        </p>
      </div>
    </div>
  );
}
