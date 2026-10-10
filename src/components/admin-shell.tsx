import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  EyeOff,
  FileText,
  LayoutDashboard,
  Menu,
  Radio,
  Truck,
  Users,
  X,
  Smartphone,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { getAdminCounters, type AdminCounters } from "@/lib/server/admin";
import { useViewer } from "@/lib/auth/use-viewer";
import { cn } from "@/lib/utils";
import { IdentityCard, SignOutButton } from "./account-menu";
import { NotificationBell } from "./admin/notification-bell";
import { Wordmark } from "./brand";
import { ThemeToggle } from "./theme-toggle";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  badge?: (c: AdminCounters) => number;
  tone?: "sos" | "violet";
};

const NAV: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/sos", label: "SOS Alerts", icon: Radio, badge: (c) => c.activeSos, tone: "sos" },
  { to: "/admin/incidents", label: "Incidents", icon: FileText, badge: (c) => c.incoming },
  { to: "/admin/anonymous", label: "Anonymous", icon: EyeOff, tone: "violet" },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/responders", label: "Responders", icon: Truck },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
];

const POLL_MS = 8000;

function isActive(pathname: string, item: NavItem) {
  return item.exact
    ? pathname === item.to || pathname === `${item.to}/`
    : pathname.startsWith(item.to);
}

/** Admin operations console frame: desktop sidebar, mobile drawer, live counters. */
export function AdminShell({ children }: { children: ReactNode }) {
  const viewer = useViewer();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [counters, setCounters] = useState<(AdminCounters & { unseenCritical: number }) | null>(
    null,
  );

  useEffect(() => {
    let live = true;
    const load = () => {
      // Skip polls while the tab is hidden; refresh as soon as it is visible again.
      if (document.visibilityState === "hidden") return;
      getAdminCounters()
        .then((c) => live && setCounters(c))
        .catch(() => {});
    };
    load();
    const t = window.setInterval(load, POLL_MS);
    document.addEventListener("visibilitychange", load);
    return () => {
      live = false;
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", load);
    };
  }, []);

  // Close the drawer on navigation; Escape closes it; lock page scroll while open.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const activeSos = counters?.activeSos ?? 0;
  const onDashboard = pathname === "/admin" || pathname === "/admin/";

  return (
    <div className="flex min-h-dvh bg-bg text-fg">
      <aside
        id="admin-nav"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-line bg-chrome pt-safe transition-transform duration-300 ease-[var(--ease-smooth-out)] lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Admin navigation"
      >
        <div className="flex items-center gap-2 border-b border-line px-4 py-4">
          <div className="min-w-0 flex-1">
            <Wordmark to="/admin" caption="OPERATIONS CONSOLE" />
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="grid size-10 place-items-center rounded-lg text-muted hover:bg-panel lg:hidden"
            aria-label="Close navigation"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV.map((item) => {
            const on = isActive(pathname, item);
            const badge = counters && item.badge ? item.badge(counters) : 0;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                  on ? "nav-active bg-panel text-fg" : "text-muted hover:bg-panel/60 hover:text-fg",
                )}
              >
                <item.icon
                  className={cn(
                    "size-4 shrink-0",
                    item.tone === "sos"
                      ? "text-sos"
                      : item.tone === "violet"
                        ? "text-violet"
                        : on
                          ? "text-neon"
                          : "text-dim",
                  )}
                />
                <span className="flex-1">{item.label}</span>
                {badge > 0 && (
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 font-mono text-[10px] font-bold",
                      item.tone === "sos" ? "bg-sos/15 text-sos" : "bg-neon-dim text-neon",
                    )}
                  >
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-line p-3 pb-[max(0.75rem,var(--safe-bottom))]">
          <Link
            to="/staff"
            className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs text-muted hover:bg-panel hover:text-fg"
          >
            <Smartphone className="size-3.5" />
            Responder field app
          </Link>
          {viewer && <IdentityCard profile={viewer} />}
          <SignOutButton className="w-full" />
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-chrome/95 pt-safe backdrop-blur-md">
          <div className="flex items-center justify-between gap-3 px-3 py-2.5 sm:px-4 lg:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="grid size-10 place-items-center rounded-lg text-muted hover:bg-panel lg:hidden"
                aria-label="Open navigation"
                aria-controls="admin-nav"
                aria-expanded={open}
              >
                <Menu className="size-5" />
              </button>
              <div className="lg:hidden">
                <Wordmark to="/admin" compact />
              </div>
              {/* The dashboard shows these as KPI cards, so skip the duplicate pills there. */}
              {!onDashboard && (
                <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
                  <CounterPill label="Active SOS" value={activeSos} tone="sos" />
                  <span className="hidden items-center gap-2 md:flex">
                    <CounterPill label="New" value={counters?.incoming ?? 0} tone="neon" />
                    <CounterPill
                      label="In progress"
                      value={counters?.inProgress ?? 0}
                      tone="warn"
                    />
                    <CounterPill
                      label="Resolved today"
                      value={counters?.resolvedToday ?? 0}
                      tone="ok"
                    />
                  </span>
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <ThemeToggle />
              <NotificationBell
                unseen={counters?.unseenCritical ?? 0}
                onSeen={() => setCounters((c) => (c ? { ...c, unseenCritical: 0 } : c))}
              />
            </div>
          </div>
          {activeSos > 0 && (
            <Link
              to="/admin/sos"
              className="block bg-sos px-4 py-1.5 text-center text-xs font-semibold text-white sm:text-sm"
            >
              {activeSos} live SOS — jump the queue
            </Link>
          )}
        </header>

        <main className="grid-bg flex min-w-0 flex-1 flex-col pb-safe">{children}</main>
      </div>
    </div>
  );
}

const TONES = {
  sos: "bg-sos/15 text-sos ring-sos/30",
  neon: "bg-neon-dim text-neon ring-neon/30",
  warn: "bg-warn/15 text-warn ring-warn/30",
  ok: "bg-ok/15 text-ok ring-ok/30",
} as const;

function CounterPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: keyof typeof TONES;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 ring-1",
        TONES[tone],
      )}
    >
      <span className="font-mono text-sm font-bold tabular-nums">{value}</span>
      <span className="whitespace-nowrap text-[10px] uppercase tracking-wider opacity-80">
        {label}
      </span>
      {tone === "sos" && value > 0 && (
        <span className="pulse-dot size-1.5 rounded-full bg-current" />
      )}
    </span>
  );
}

/** Standard admin page heading row. */
export function AdminPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
