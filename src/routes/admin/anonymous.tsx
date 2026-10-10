import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, EyeOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Panel, ReplyForm, StatusButtons, ThreadList } from "@/components/admin/case-panels";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { SeverityChip, StatusPill } from "@/components/shared/pills";
import { listAnonymousAdmin } from "@/backend/functions/admin";
import { postThread, staffSetAnonymousStatus, trackAnonymous } from "@/backend/functions/reports";
import type { ThreadMessage } from "@/lib/types";
import { cn, formatClock } from "@/lib/utils";
import { SkeletonList } from "@/components/shared/skeleton";

export const Route = createFileRoute("/admin/anonymous")({ component: AnonymousPage });

type Row = Awaited<ReturnType<typeof listAnonymousAdmin>>[number];

function AnonymousPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(
    () =>
      listAnonymousAdmin()
        .then(setRows)
        .catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not load reports")),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5 p-4 sm:p-5 lg:p-6">
      <AdminPageHeader
        title="Anonymous reports"
        subtitle="The reporter is never identified. Replies land on their private tracking code."
      />
      {error && (
        <p className="card p-4 text-sm text-sos" role="alert">
          {error}
        </p>
      )}
      {rows === null && !error && <SkeletonList rows={4} />}
      {rows?.length === 0 && <p className="card p-6 text-sm text-muted">No anonymous reports.</p>}
      <ul className="space-y-2.5">
        {rows?.map((r) => (
          <li key={r.id} className="card overflow-hidden">
            <button
              type="button"
              onClick={() => setOpen(open === r.id ? null : r.id)}
              aria-expanded={open === r.id}
              className="flex w-full items-start gap-3 p-4 text-left hover:bg-panel-2/50"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet/15">
                <EyeOff className="size-4 text-violet" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{r.categoryName}</p>
                <p className="font-mono text-xs text-violet">{r.trackingCode}</p>
                <p className="truncate text-xs text-muted">
                  {r.locationName} · {r.role} · {formatClock(r.createdAt)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5 sm:flex-row sm:items-center">
                <SeverityChip value={r.severity} />
                <StatusPill status={r.status} />
              </div>
              <ChevronDown
                className={cn(
                  "mt-1 size-4 shrink-0 text-dim transition-transform",
                  open === r.id && "rotate-180",
                )}
              />
            </button>
            {open === r.id && <AnonymousCase row={r} onChanged={load} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AnonymousCase({ row, onChanged }: { row: Row; onChanged: () => Promise<unknown> }) {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [busy, setBusy] = useState(false);

  const loadThread = useCallback(
    () => trackAnonymous({ data: { code: row.trackingCode } }).then((t) => setMessages(t.messages)),
    [row.trackingCode],
  );
  useEffect(() => {
    void loadThread().catch(() => {});
  }, [loadThread]);

  return (
    <div className="space-y-4 border-t border-line p-4">
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{row.description}</p>
      <p className="text-xs text-muted">When: {row.timeRange}</p>
      <Panel title="Status">
        <StatusButtons
          current={row.status}
          disabled={busy}
          onPick={(status) => {
            setBusy(true);
            staffSetAnonymousStatus({ data: { id: row.id, status } })
              .then(() => Promise.all([onChanged(), loadThread()]))
              .then(() => toast.success("Status updated"))
              .catch((err: unknown) =>
                toast.error(err instanceof Error ? err.message : "Action failed"),
              )
              .finally(() => setBusy(false));
          }}
        />
      </Panel>
      <Panel title="Conversation">
        <ThreadList messages={messages} />
        <div className="mt-3">
          <ReplyForm
            placeholder="Reply via tracking code"
            onSend={async (body) => {
              await postThread({ data: { kind: "anonymous", subjectId: row.id, body } });
              await loadThread();
            }}
          />
        </div>
      </Panel>
    </div>
  );
}
