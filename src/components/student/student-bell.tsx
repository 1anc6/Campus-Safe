import * as Popover from "@radix-ui/react-popover";
import { Link } from "@tanstack/react-router";
import { Bell, BellOff, ChevronRight, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getMyNotifications, markMyNotificationsSeen } from "@/backend/functions/notifications";
import type { StudentNotification } from "@/lib/types";
import { cn, waitLabel } from "@/lib/utils";

/**
 * Student bell: updates command or a responder made on the student's own
 * reports. The badge counts updates since the bell was last opened; opening it
 * marks them seen (server-side, so it clears on every device).
 */
export function StudentBell({
  side = "bottom",
  className,
}: {
  side?: "bottom" | "right";
  className?: string;
}) {
  const [items, setItems] = useState<StudentNotification[] | null>(null);
  const [unseen, setUnseen] = useState(0);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const d = await getMyNotifications();
    setItems(d.items);
    setUnseen(d.unseen);
    return d;
  }, []);

  useEffect(() => {
    void load().catch(() => {});
    const i = window.setInterval(() => {
      if (document.visibilityState === "visible") void load().catch(() => {});
    }, 60_000);
    return () => window.clearInterval(i);
  }, [load]);

  async function onOpenChange(open: boolean) {
    if (!open) return;
    setError(false);
    try {
      const d = await load();
      // Tag what was new before this open, then clear the badge.
      setNewIds(new Set(d.items.slice(0, d.unseen).map((n) => n.id)));
      if (d.unseen > 0) {
        await markMyNotificationsSeen();
        setUnseen(0);
      }
    } catch {
      setError(true);
    }
  }

  return (
    <Popover.Root onOpenChange={(o) => void onOpenChange(o)}>
      <Popover.Trigger
        className={cn(
          "relative grid size-11 shrink-0 place-items-center rounded-2xl text-muted hover:bg-panel-2 hover:text-fg data-[state=open]:bg-panel-2 data-[state=open]:text-fg",
          className,
        )}
        aria-label={
          unseen > 0 ? `${unseen} new updates on your reports` : "Updates on your reports"
        }
      >
        <Bell className="size-[18px]" />
        {unseen > 0 && (
          <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-[var(--sos-fill)] px-1 font-mono text-[9px] font-bold text-white ring-2 ring-chrome">
            {unseen > 99 ? "99+" : unseen}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side={side}
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-[1200] w-[min(92vw,360px)] overflow-hidden rounded-2xl bg-chrome shadow-[var(--neu-raised)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="text-sm font-semibold">Updates on your reports</p>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {error ? (
              <p className="p-6 text-center text-sm text-sos">Couldn't load updates. Try again.</p>
            ) : items === null ? (
              <div className="grid place-items-center p-8">
                <LoaderCircle className="size-5 animate-spin text-muted" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-8 text-center">
                <BellOff className="size-6 text-dim" />
                <p className="text-sm font-medium">No updates yet</p>
                <p className="text-xs text-muted">
                  When command reviews or updates a report you filed, it shows up here.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {items.map((n) => (
                  <li key={n.id}>
                    <Popover.Close asChild>
                      <Link
                        to="/reports/$id"
                        params={{ id: n.incidentId }}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-panel",
                          newIds.has(n.id) && "bg-neon-dim",
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">{n.title}</span>
                            {newIds.has(n.id) && (
                              <span className="shrink-0 rounded bg-neon px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-ink">
                                New
                              </span>
                            )}
                          </span>
                          <span className="block truncate text-xs text-muted">{n.body}</span>
                          <span className="block text-[11px] text-dim">{waitLabel(n.at)} ago</span>
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-dim" />
                      </Link>
                    </Popover.Close>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
