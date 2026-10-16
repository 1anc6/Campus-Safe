import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  EyeOff,
  FileText,
  LayoutDashboard,
  Megaphone,
  Menu,
  Radio,
  Search,
  Truck,
  Users,
  X,
  Smartphone,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { getAdminCounters, type AdminCounters } from "@/backend/functions/admin";
import { useViewer } from "@/lib/auth/use-viewer";
import { cn } from "@/lib/utils";
import { IdentityCard, SignOutButton } from "@/components/shared/account-menu";
import { NotificationBell } from "@/components/admin/notification-bell";
import { AdminCommandPalette, PaletteShortcutKeys } from "@/components/admin/command-palette";
import { Wordmark } from "@/components/shared/brand";
import { ThemeToggle } from "@/components/shared/theme-toggle";

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
  { to: "/admin/alerts", label: "Broadcasts", icon: Megaphone },
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
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [counters, setCounters] = useState<(AdminCounters & { unseenCritical: number }) | null>(
    null,
  );

  useEffect(() => {
    let live = true;
    let lastLoad = 0;
    const load = () => {
      // Background tab: slow down to once a minute rather than stopping — this
      // poll also drives the safe-walk watchdog, which must keep running.
      if (document.visibilityState === "hidden" && Date.now() - lastLoad < 60_000) return;
      lastLoad = Date.now();
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

  // Local time of day, computed in the browser (the server's clock/timezone may differ).
  const [hello, setHello] = useState<{ greeting: string; date: string } | null>(null);
  useEffect(() => {
    setHello({
      greeting: greeting(),
      date: new Date().toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    });
  }, []);

  const activeSos = counters?.activeSos ?? 0;
  const onDashboard = pathname === "/admin" || pathname === "/admin/";

  return (
    <div className="flex min-h-dvh text-fg">
      <aside
        id="admin-nav"
        className={cn(
          "glass-bar vt-rail fixed bottom-3 left-3 top-[max(0.75rem,var(--safe-top))] z-50 flex w-64 flex-col rounded-[28px] transition-transform duration-300 ease-[var(--ease-smooth-out)] lg:sticky lg:top-3 lg:my-3 lg:ml-3 lg:h-[calc(100dvh-1.5rem)] lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-[calc(100%+1.5rem)]",
        )}
        aria-label="Admin navigation"
      >
        <div className="flex items-center gap-2 px-5 py-4">
          <div className="min-w-0 flex-1">
            <Wordmark to="/admin" caption="OPERATIONS CONSOLE" />
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="grid size-10 place-items-center rounded-2xl text-muted hover:bg-panel-2 lg:hidden"
            aria-label="Close navigation"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {NAV.map((item) => {
            const on = isActive(pathname, item);
            const badge = counters && item.badge ? item.badge(counters) : 0;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-2xl px-3.5 text-sm transition-[background-color,color,box-shadow] duration-200",
                  on ? "neu-pressed text-fg" : "text-muted hover:bg-panel-2 hover:text-fg",
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
                      "rounded-full px-2 py-0.5 font-mono text-[10px] font-bold",
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

        <div className="space-y-1 p-3">
          <Link
            to="/staff"
            className="flex min-h-10 items-center gap-2 rounded-2xl px-3.5 text-xs text-muted hover:bg-panel-2 hover:text-fg"
          >
            <Smartphone className="size-3.5" />
            Responder field app
          </Link>
          {viewer && <IdentityCard profile={viewer} />}
          <SignOutButton className="w-full rounded-2xl" />
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
        <header className="sticky top-0 z-30 px-3 pt-[max(0.75rem,var(--safe-top))] lg:px-6">
          <div className="glass-bar vt-topbar flex items-center justify-between gap-3 rounded-[22px] py-1.5 pl-2 pr-1.5 sm:pl-3">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="grid size-10 place-items-center rounded-2xl text-muted hover:bg-panel-2 lg:hidden"
                aria-label="Open navigation"
                aria-controls="admin-nav"
                aria-expanded={open}
              >
                <Menu className="size-5" />
              </button>
              <div className="lg:hidden">
                <Wordmark to="/admin" compact />
              </div>
              {/* The dashboard shows these as KPI cards, so it greets instead of repeating them. */}
              {onDashboard && hello && (
                <p className="hidden min-w-0 truncate pl-1 text-sm lg:block">
                  <span className="font-medium">
                    {hello.greeting}, {viewer?.name.split(" ")[0] ?? "Command"}
                  </span>
                  <span className="text-muted"> · {hello.date}</span>
                </p>
              )}
              {!onDashboard && (
                <div className="flex shrink-0 items-center gap-2">
                  <CounterPill label="Active SOS" short="SOS" value={activeSos} tone="sos" />
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
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                aria-label="Search pages, cases and actions"
                aria-keyshortcuts="Control+K Meta+K"
                className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-2xl px-2.5 text-muted transition-colors hover:bg-panel-2 hover:text-fg"
              >
                <Search className="size-[18px]" aria-hidden="true" />
                <PaletteShortcutKeys className="hidden xl:flex" />
              </button>
              <ThemeToggle className="rounded-2xl ring-0 hover:bg-panel-2" />
              <NotificationBell
                unseen={counters?.unseenCritical ?? 0}
                onSeen={() => setCounters((c) => (c ? { ...c, unseenCritical: 0 } : c))}
              />
            </div>
          </div>
          {activeSos > 0 && (
            <Link
              to="/admin/sos"
              className="mt-2 block rounded-2xl bg-[var(--sos-fill)] px-4 py-2 text-center text-xs font-semibold text-white shadow-[0_8px_24px_-8px_var(--sos-glow)] sm:text-sm"
            >
              {activeSos} live SOS — jump the queue
            </Link>
          )}
        </header>

        <main className="flex min-w-0 flex-1 flex-col pb-safe">{children}</main>
      </div>
      <AdminCommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

const TONES = {
  sos: "bg-sos/12 text-sos",
  neon: "bg-neon-dim text-neon",
  warn: "bg-warn/12 text-warn",
  ok: "bg-ok/12 text-ok",
} as const;

function CounterPill({
  label,
  short,
  value,
  tone,
}: {
  label: string;
  /** Label used on narrow phones, where the full one would be cut off. */
  short?: string;
  value: number;
  tone: keyof typeof TONES;
}) {
  return (
    <span
      className={cn(
        "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 shadow-[var(--neu-inset-sm)] sm:gap-2",
        TONES[tone],
      )}
      aria-label={`${value} ${label}`}
    >
      <span className="font-mono text-sm font-bold tabular-nums" aria-hidden="true">
        {value}
      </span>
      <span
        className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider"
        aria-hidden="true"
      >
        {short ? (
          <>
            <span className="sm:hidden">{short}</span>
            <span className="hidden sm:inline">{label}</span>
          </>
        ) : (
          label
        )}
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
