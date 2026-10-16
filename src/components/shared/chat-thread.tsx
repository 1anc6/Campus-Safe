import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, LoaderCircle, Send } from "lucide-react";
import type { ThreadMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

type Role = ThreadMessage["authorRole"];

/** One-tap questions command asks a student in trouble. */
export const STAFF_QUICK_REPLIES = [
  "Are you safe right now?",
  "Help is on the way. Stay where you are.",
  "Where exactly are you?",
  "Are you injured?",
  "Can you call us?",
];

export const STAFF_CHAT_LABELS = {
  reporter: "Student",
  admin: "Campus command",
  responder: "Responder",
} as const;

/**
 * Two-way SOS conversation between the student and campus command.
 * `selfRoles` decides which side is "me" (right, blue); everything else sits
 * left on the raised surface, and system events are quiet centred notes.
 * Quick replies send in one tap, because typing is hard when you are scared.
 */
export function ChatThread({
  messages,
  selfRoles,
  labels,
  onSend,
  quickReplies = [],
  disabled,
  disabledNote,
  placeholder = "Write a message",
  className,
}: {
  messages: ThreadMessage[];
  selfRoles: Role[];
  labels: Partial<Record<Role, string>>;
  onSend: (body: string) => Promise<unknown>;
  quickReplies?: string[];
  disabled?: boolean;
  disabledNote?: string;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unseen, setUnseen] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const lastCount = useRef(messages.length);
  /** Messages on screen when the thread opened: only later arrivals animate in. */
  const initialIds = useRef(new Set(messages.map((m) => m.id)));

  const scrollToEnd = (smooth: boolean) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    setUnseen(0);
  };

  // Follow the conversation while the reader is at the bottom; otherwise count
  // what arrived so they can jump down when ready.
  useLayoutEffect(() => {
    const added = messages.length - lastCount.current;
    lastCount.current = messages.length;
    if (added <= 0 && !pending) return;
    if (atBottom.current) scrollToEnd(added < 4);
    else if (added > 0) setUnseen((n) => n + added);
  }, [messages.length, pending]);

  useEffect(() => scrollToEnd(false), []);

  async function send(text: string) {
    const body = text.trim();
    if (!body || pending || disabled) return;
    setPending(body);
    setError(null);
    atBottom.current = true;
    try {
      await onSend(body);
      setDraft((d) => (d.trim() === body ? "" : d));
    } catch (err) {
      setDraft(body);
      setError(err instanceof Error ? err.message : "Could not send. Try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className={cn("card flex min-h-0 flex-col", className)} aria-label="Messages">
      <div className="relative min-h-0 flex-1">
        <div
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget;
            atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
            if (atBottom.current) setUnseen(0);
          }}
          className="max-h-[min(26rem,55dvh)] min-h-40 overflow-y-auto px-3 pb-2 pt-4 sm:px-4"
        >
          {messages.length === 0 && !pending ? (
            <p className="py-8 text-center text-sm text-muted">No messages yet.</p>
          ) : (
            <ol className="flex flex-col gap-2.5" aria-live="polite" aria-relevant="additions">
              {messages.map((m, i) => {
                const prev = messages[i - 1];
                const grouped =
                  prev && prev.authorRole === m.authorRole && m.authorRole !== "system";
                return (
                  <Bubble
                    key={m.id}
                    message={m}
                    mine={selfRoles.includes(m.authorRole)}
                    label={labels[m.authorRole] ?? m.authorRole}
                    grouped={Boolean(grouped)}
                    fresh={!initialIds.current.has(m.id)}
                  />
                );
              })}
              {pending && (
                <li className="flex justify-end">
                  <div className="max-w-[82%] rounded-[18px] rounded-br-md bg-[image:var(--accent-fill)] px-3.5 py-2 text-sm text-on-accent opacity-70">
                    <p className="whitespace-pre-wrap break-words">{pending}</p>
                    <p className="mt-0.5 text-right text-[11px] opacity-85">Sending…</p>
                  </div>
                </li>
              )}
            </ol>
          )}
        </div>
        {unseen > 0 && (
          <button
            type="button"
            onClick={() => scrollToEnd(true)}
            className="btn-ghost absolute bottom-2 left-1/2 min-h-9 -translate-x-1/2 rounded-full px-3.5 text-xs text-neon"
          >
            <ArrowDown className="size-3.5" />
            {unseen === 1 ? "1 new message" : `${unseen} new messages`}
          </button>
        )}
      </div>

      <div className="border-t border-line p-3 sm:p-4">
        {disabled ? (
          <p className="text-center text-xs text-muted">
            {disabledNote ?? "This conversation is closed."}
          </p>
        ) : (
          <>
            {quickReplies.length > 0 && (
              <div
                className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 py-1 [scrollbar-width:none]"
                role="group"
                aria-label="Quick replies"
              >
                {quickReplies.map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={Boolean(pending)}
                    onClick={() => void send(q)}
                    className="btn-ghost min-h-9 shrink-0 rounded-full px-3.5 text-xs font-semibold"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(draft);
              }}
              className="flex items-end gap-2"
            >
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send(draft);
                  }
                }}
                rows={1}
                maxLength={1000}
                placeholder={placeholder}
                aria-label={placeholder}
                className="input max-h-32 min-h-11 flex-1 resize-none py-2.5 [field-sizing:content]"
              />
              <button
                type="submit"
                disabled={Boolean(pending) || !draft.trim()}
                className="btn-neon size-11 shrink-0 rounded-full p-0"
                aria-label="Send message"
              >
                {pending ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </button>
            </form>
            {error && (
              <p className="mt-2 text-xs text-sos" role="alert">
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function Bubble({
  message: m,
  mine,
  label,
  grouped,
  fresh,
}: {
  message: ThreadMessage;
  mine: boolean;
  label: string;
  grouped: boolean;
  /** Arrived after the thread opened: rises in instead of just appearing. */
  fresh: boolean;
}) {
  if (m.authorRole === "system") {
    return (
      <li className={cn("flex justify-center", fresh && "chat-enter")}>
        <p className="neu-well max-w-[90%] rounded-2xl px-3 py-1.5 text-center text-[11px] leading-snug text-muted">
          {m.body} <span className="text-dim">· {chatTime(m.createdAt)}</span>
        </p>
      </li>
    );
  }
  return (
    <li
      className={cn(
        "flex flex-col",
        mine ? "items-end origin-bottom-right" : "items-start origin-bottom-left",
        grouped && "-mt-1",
        fresh && "chat-enter",
      )}
    >
      {!grouped && (
        <span
          className={cn("mb-1 px-1 text-[11px] font-semibold text-muted", mine && "text-right")}
        >
          {label}
        </span>
      )}
      <div
        className={cn(
          "max-w-[82%] px-3.5 py-2 text-sm",
          mine
            ? "rounded-[18px] rounded-br-md bg-[image:var(--accent-fill)] text-on-accent shadow-[var(--accent-lift)]"
            : "neu-raised-xs rounded-[18px] rounded-bl-md text-fg",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{m.body}</p>
        <p className={cn("mt-0.5 text-[11px]", mine ? "text-right text-on-accent/80" : "text-dim")}>
          {chatTime(m.createdAt)}
        </p>
      </div>
    </li>
  );
}

/** "6:31 PM" for today, "15 Oct, 6:31 PM" for older messages. */
function chatTime(at: string) {
  const d = new Date(at);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === new Date().toDateString()) return time;
  return `${d.toLocaleDateString(undefined, { day: "numeric", month: "short" })}, ${time}`;
}
