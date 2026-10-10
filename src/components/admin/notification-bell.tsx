import * as Popover from "@radix-ui/react-popover";
import { Link } from "@tanstack/react-router";
import { Bell, BellOff, ChevronRight, EyeOff, FileText, LoaderCircle, Radio } from "lucide-react";
import { useState } from "react";
import {
  getAdminNotifications,
  markAdminNotificationsSeen,
  type AdminNotification,
} from "@/backend/functions/admin";
import { cn, waitLabel } from "@/lib/utils";

const ICONS = { sos: Radio, incident: FileText, anonymous: EyeOff } as const;

/**
 * Admin bell. The badge counts critical items that arrived since this admin
 * last opened the bell; opening it marks them seen (per admin, server-side), so
 * the badge clears here and on the admin's other devices. Items themselves stay
 * listed until they are resolved.
 */
export function NotificationBell({ unseen, onSeen }: { unseen: number; onSeen: () => void }) {
  const [items, setItems] = useState<AdminNotification[] | null>(null);
  const [error, setError] = useState(false);

  async function onOpenChange(open: boolean) {
    if (!open) return;
    setError(false);
    try {
      // Fetch first so "New" tags reflect the state before this open.
      setItems(await getAdminNotifications());
      if (unseen > 0) {
        await markAdminNotificationsSeen();
        onSeen();
      }
    } catch {
      setError(true);
    }
  }

  return (
    <Popover.Root onOpenChange={(o) => void onOpenChange(o)}>
      <Popover.Trigger
        className="relative grid size-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-panel hover:text-fg data-[state=open]:bg-panel data-[state=open]:text-fg"
        aria-label={unseen > 0 ? `${unseen} new critical alerts` : "Critical alerts"}
      >
        <Bell className="size-4" />
        {unseen > 0 && (
          <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-sos px-1 font-mono text-[9px] font-bold text-white ring-2 ring-chrome">
            {unseen > 99 ? "99+" : unseen}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-[1200] w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-line bg-chrome shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold">Critical alerts</p>
            <span className="text-[11px] text-muted">Open SOS & P1 reports</span>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {error ? (
              <p className="p-6 text-center text-sm text-sos">Couldn't load alerts. Try again.</p>
            ) : items === null ? (
              <div className="grid place-items-center p-8">
                <LoaderCircle className="size-5 animate-spin text-muted" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-8 text-center">
                <BellOff className="size-6 text-dim" />
                <p className="text-sm font-medium">Nothing critical open</p>
                <p className="text-xs text-muted">New SOS alerts and P1 reports appear here.</p>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {items.map((n) => (
                  <li key={`${n.kind}-${n.id}`}>
                    <Popover.Close asChild>
                      <NotificationLink n={n} />
                    </Popover.Close>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Popover.Close asChild>
            <Link
              to="/admin/incidents"
              search={{ severity: "P1" }}
              className="flex min-h-11 items-center justify-center gap-1 border-t border-line text-xs font-medium text-neon hover:bg-panel"
            >
              All P1 incidents <ChevronRight className="size-3.5" />
            </Link>
          </Popover.Close>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function NotificationLink({ n, ...rest }: { n: AdminNotification }) {
  const Icon = ICONS[n.kind];
  const body = (
    <>
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-xl",
          n.kind === "sos"
            ? "bg-sos/15 text-sos"
            : n.kind === "anonymous"
              ? "bg-violet/15 text-violet"
              : "bg-warn/15 text-warn",
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{n.title}</span>
          {n.unseen && (
            <span className="shrink-0 rounded bg-sos px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-white">
              New
            </span>
          )}
        </span>
        <span className="block truncate text-[11px] text-muted">
          {n.kind === "sos" ? "SOS" : n.kind === "anonymous" ? "Anonymous · P1" : "Incident · P1"}
          {n.place ? ` · ${n.place}` : ""} · {waitLabel(n.at)} ago
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-dim" />
    </>
  );
  const className = cn(
    "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-panel",
    n.unseen && "bg-sos/5",
  );

  if (n.kind === "sos") {
    return (
      <Link {...rest} to="/admin/sos/$id" params={{ id: n.id }} className={className}>
        {body}
      </Link>
    );
  }
  if (n.kind === "incident") {
    return (
      <Link {...rest} to="/admin/incidents/$id" params={{ id: n.id }} className={className}>
        {body}
      </Link>
    );
  }
  return (
    <Link {...rest} to="/admin/anonymous" className={className}>
      {body}
    </Link>
  );
}
