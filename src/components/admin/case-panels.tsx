import { useState, type ReactNode } from "react";
import { LoaderCircle, Send } from "lucide-react";
import { INCIDENT_STATUSES, type IncidentStatus } from "@/lib/campus";
import type { Responder, ThreadMessage } from "@/lib/types";
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
            "rounded-lg p-3 text-sm ring-1 ring-line",
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
}: {
  responders: Responder[];
  current: string | null;
  onPick: (id: string) => void;
  disabled?: boolean;
}) {
  if (responders.length === 0) return <p className="text-sm text-muted">No responder units yet.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {responders.map((r) => {
        const on = r.id === current;
        return (
          <button
            key={r.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(r.id)}
            aria-pressed={on}
            className={cn(
              "min-h-10 rounded-full px-3 text-xs font-semibold ring-1 transition-colors disabled:opacity-50",
              on ? "bg-fg text-panel ring-fg" : "ring-line hover:bg-panel-2",
            )}
          >
            {r.name}
            <span
              className={cn("ml-1.5 font-normal", on ? "text-panel/70" : UNIT_STATUS[r.status])}
            >
              · {r.unit}
            </span>
          </button>
        );
      })}
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
                ? "bg-neon-dim text-neon ring-neon/40"
                : "ring-line hover:bg-panel-2 disabled:opacity-50",
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
