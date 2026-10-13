import { createFileRoute } from "@tanstack/react-router";
import { AdaptiveShell } from "@/components/student/student-shell";
import { SeverityChip, StatusPill } from "@/components/shared/pills";
import { StatusStepper } from "@/components/shared/status-stepper";
import { INCIDENT_STATUSES } from "@/lib/campus";
import { replyAnonymousPublic, trackAnonymous } from "@/backend/functions/reports";
import { formatClock } from "@/lib/utils";
import type { AnonymousReport, ThreadMessage } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";

export const Route = createFileRoute("/track/$code")({ component: TrackPage });

function TrackPage() {
  const { code } = Route.useParams();
  const [report, setReport] = useState<AnonymousReport | null | undefined>(undefined);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [body, setBody] = useState("");

  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await trackAnonymous({ data: { code } });
    setReport(res.report);
    setMessages(res.messages);
  }, [code]);

  useEffect(() => {
    load().catch(() => setError("Could not look up this code right now. Try again shortly."));
  }, [load]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    try {
      await replyAnonymousPublic({ data: { code, body: body.trim() } });
      setBody("");
      await load();
    } catch {
      setError("Your reply could not be sent. Try again.");
    }
  }

  return (
    <AdaptiveShell anon>
      <p className="text-xs font-semibold uppercase tracking-wider text-violet">
        Anonymous track
      </p>
      <p className="mt-2 break-all font-mono text-xl font-semibold tracking-wide text-neon">
        {code.toUpperCase()}
      </p>
      {error && (
        <p className="mt-4 text-sm text-sos" role="alert">
          {error}
        </p>
      )}
      {report === undefined && !error && <p className="mt-6 text-sm text-muted">Looking up…</p>}
      {report === null && (
        <p className="mt-6 text-sm text-sos">
          No report for that code. Codes are case-insensitive.
        </p>
      )}
      {report && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-2">
            <SeverityChip value={report.severity} />
            <StatusPill status={report.status} />
          </div>
          <h1 className="font-display text-2xl font-semibold">{report.categoryName}</h1>
          <p className="text-sm text-muted">
            {report.locationName} · {report.timeRange} · {report.role}
          </p>
          <p className="card p-4 text-sm">{report.description}</p>
          <div className="card p-4">
            <StatusStepper steps={INCIDENT_STATUSES} current={report.status} />
          </div>
          <div className="space-y-2">
            {messages.map((m) => (
              <div key={m.id} className="rounded-xl bg-panel p-3 text-sm ring-1 ring-line">
                <p className="text-[11px] uppercase tracking-wider text-muted">
                  {m.authorRole === "reporter" ? "You" : m.authorRole} · {formatClock(m.createdAt)}
                </p>
                <p className="mt-1">{m.body}</p>
              </div>
            ))}
          </div>
          <form onSubmit={send} className="flex gap-2">
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Reply without revealing who you are"
              className="input min-h-12 flex-1"
              maxLength={1000}
            />
            <button type="submit" className="btn-neon px-5">
              Send
            </button>
          </form>
        </div>
      )}
    </AdaptiveShell>
  );
}
