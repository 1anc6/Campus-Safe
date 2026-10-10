import { Link, useRouterState } from "@tanstack/react-router";
import { EyeOff, FileWarning, FolderOpen, Home, Phone } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useViewer } from "@/lib/auth/use-viewer";
import { SECURITY_LINE } from "@/lib/campus";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/shared/account-menu";
import { Wordmark } from "@/components/shared/brand";
import { ProfileButton, ProfilePanelProvider } from "@/components/student/profile-panel";
import { SosFlowProvider, SosTrigger } from "@/components/student/sos-flow";
import { ThemeToggle } from "@/components/shared/theme-toggle";

const TABS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/report", label: "Report", icon: FileWarning },
  { to: "/anonymous", label: "Anonymous", icon: EyeOff },
  { to: "/reports", label: "My Reports", icon: FolderOpen },
] as const;

const WIDTHS = {
  narrow: "max-w-2xl",
  wide: "max-w-6xl",
  /** Dashboard: use the whole viewport (multi-panel layouts). */
  full: "max-w-none",
} as const;

function tabActive(pathname: string, to: string) {
  return to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);
}

/** Violet "anonymous" theme while mounted (applies to <html> so portals match). */
function useAnonTheme(anon: boolean | undefined) {
  useEffect(() => {
    if (!anon) return;
    document.documentElement.classList.add("anon");
    return () => document.documentElement.classList.remove("anon");
  }, [anon]);
}

/**
 * Student experience frame.
 * - <768px: sticky top bar (brand + theme toggle) and a bottom tab bar with a raised
 *   hold-to-send SOS in the middle, in the safe areas.
 * - 768–1535px: compact icon rail (SOS under the tabs), so multi-panel pages keep their width.
 * - ≥1536px: full labelled sidebar.
 * Every SOS button shares one flow (`SosFlowProvider`): countdown, send, retry.
 * Each page picks its content width (`narrow` forms, `wide` lists, `full` dashboard).
 */
export function StudentShell({
  children,
  anon,
  width = "wide",
}: {
  children: ReactNode;
  anon?: boolean;
  width?: keyof typeof WIDTHS;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useAnonTheme(anon);

  return (
    <SosFlowProvider>
      <ProfilePanelProvider>
        <div className="min-h-dvh overflow-x-clip text-fg md:flex">
          {/* Desktop: a floating glass rail. */}
          <div className="sticky top-0 hidden h-dvh shrink-0 p-3 pr-0 md:block">
            <aside
              className="glass-bar vt-rail flex h-full w-[76px] flex-col rounded-[28px] 2xl:w-60"
              aria-label="Student sidebar"
            >
              <div className="flex h-[68px] items-center justify-center px-3 2xl:justify-start 2xl:px-5">
                <span className="2xl:hidden">
                  <Wordmark to="/" compact />
                </span>
                <span className="hidden 2xl:block">
                  <Wordmark to="/" caption="STUDENT SAFETY" />
                </span>
              </div>
              <nav className="flex-1 space-y-1.5 px-3 py-3" aria-label="Student navigation">
                {TABS.map((t) => {
                  const on = tabActive(pathname, t.to);
                  return (
                    <Link
                      key={t.to}
                      to={t.to}
                      aria-current={on ? "page" : undefined}
                      aria-label={t.label}
                      title={t.label}
                      className={cn(
                        "flex min-h-11 items-center justify-center gap-3 rounded-2xl text-sm font-medium transition-[background-color,color,box-shadow] duration-200 2xl:justify-start 2xl:px-3.5",
                        on
                          ? "bg-accent/15 text-fg shadow-[inset_0_0_0_1px_var(--color-neon-dim)]"
                          : "text-muted hover:bg-panel-2 hover:text-fg",
                      )}
                    >
                      <t.icon
                        className={cn("size-[18px] shrink-0", on ? "text-neon" : "text-dim")}
                      />
                      <span className="hidden 2xl:inline">{t.label}</span>
                    </Link>
                  );
                })}
                <div className="flex flex-col items-center gap-1 pt-5 2xl:flex-row 2xl:gap-3 2xl:px-1">
                  <SosTrigger size="sm" className="mx-0" />
                  <span className="hidden text-left 2xl:block">
                    <span className="block text-sm font-semibold text-sos">Emergency SOS</span>
                    <span className="block text-[11px] text-muted">Hold for 2 seconds</span>
                  </span>
                </div>
              </nav>
              <div className="space-y-1.5 p-3">
                <a
                  href={`tel:${SECURITY_LINE.phone.replaceAll(" ", "")}`}
                  title={`Call ${SECURITY_LINE.label}: ${SECURITY_LINE.phone}`}
                  aria-label={`Call ${SECURITY_LINE.label}, ${SECURITY_LINE.phone}`}
                  className="flex min-h-11 items-center justify-center gap-3 rounded-2xl bg-sos/10 ring-1 ring-sos/20 transition-colors hover:bg-sos/15 2xl:justify-start 2xl:px-3.5 2xl:py-3"
                >
                  <Phone className="size-4 shrink-0 text-sos" />
                  <span className="hidden min-w-0 2xl:block">
                    <span className="block text-xs font-semibold text-fg">
                      {SECURITY_LINE.label}
                    </span>
                    <span className="block font-mono text-[11px] text-muted">
                      {SECURITY_LINE.phone}
                    </span>
                  </span>
                </a>
                <span className="block 2xl:hidden">
                  <ThemeToggle className="w-full rounded-2xl ring-0 hover:bg-panel-2" />
                </span>
                <span className="hidden 2xl:block">
                  <ThemeToggle withLabel className="rounded-2xl ring-0 hover:bg-panel-2" />
                </span>
                <span className="flex justify-center 2xl:hidden">
                  <ProfileButton className="rounded-2xl" />
                </span>
                <span className="hidden 2xl:block">
                  <ProfileButton withName className="rounded-2xl" />
                </span>
                <span className="block 2xl:hidden">
                  <SignOutButton compact className="w-full justify-center rounded-2xl px-0" />
                </span>
                <span className="hidden 2xl:block">
                  <SignOutButton className="w-full rounded-2xl" />
                </span>
              </div>
            </aside>
          </div>

          <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
            {/* Phone: a floating glass top bar. */}
            <header className="sticky top-0 z-30 px-3 pt-[max(0.5rem,var(--safe-top))] md:hidden">
              <div className="glass-bar vt-topbar flex items-center justify-between gap-3 rounded-[22px] py-1.5 pl-3 pr-1.5">
                <Wordmark to="/" />
                {/* Sign-out and settings live in the profile panel behind the avatar. */}
                <div className="flex items-center gap-1">
                  <ThemeToggle className="rounded-2xl ring-0 hover:bg-panel-2" />
                  <ProfileButton className="rounded-2xl" />
                </div>
              </div>
            </header>

            <main
              className={cn(
                "mx-auto flex w-full flex-1 flex-col px-4 pt-4 sm:px-6 md:px-6 md:pb-8 md:pt-6 xl:px-8",
                "pb-[calc(8rem+var(--safe-bottom))]",
                WIDTHS[width],
              )}
            >
              {children}
            </main>
          </div>

          {/* Phone: a floating glass pill tab bar with SOS raised in the middle. */}
          <nav
            className="fixed inset-x-3 bottom-[max(0.75rem,var(--safe-bottom))] z-30 md:hidden"
            aria-label="Student navigation"
          >
            <ul className="glass-bar vt-tabbar mx-auto grid max-w-lg grid-cols-5 rounded-[28px] px-1.5">
              {TABS.slice(0, 2).map((t) => (
                <TabLink key={t.to} tab={t} on={tabActive(pathname, t.to)} />
              ))}
              {/* SOS rides up out of the bar so it is the biggest target on screen. */}
              <li className="relative flex justify-center">
                <span className="glass-bar absolute -top-9 rounded-full p-1">
                  <SosTrigger size="md" />
                </span>
              </li>
              {TABS.slice(2).map((t) => (
                <TabLink key={t.to} tab={t} on={tabActive(pathname, t.to)} />
              ))}
            </ul>
          </nav>
        </div>
      </ProfilePanelProvider>
    </SosFlowProvider>
  );
}

function TabLink({ tab, on }: { tab: (typeof TABS)[number]; on: boolean }) {
  return (
    <li>
      <Link
        to={tab.to}
        aria-current={on ? "page" : undefined}
        className={cn(
          "flex min-h-[62px] flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium transition-colors duration-200",
          on ? "text-neon" : "text-muted",
        )}
      >
        <span
          className={cn(
            "grid h-8 w-12 place-items-center rounded-full transition-[background-color,transform] duration-300 ease-[var(--ease-smooth-out)]",
            on ? "scale-100 bg-accent/15" : "scale-95",
          )}
        >
          <tab.icon className="size-[19px]" />
        </span>
        <span className="max-w-full truncate px-0.5">{tab.label}</span>
      </Link>
    </li>
  );
}
/** Frame for public pages (anonymous report, tracker) when nobody — or a non-student — is signed in. */
export function PublicShell({
  children,
  anon,
  width = "narrow",
}: {
  children: ReactNode;
  anon?: boolean;
  width?: keyof typeof WIDTHS;
}) {
  const viewer = useViewer();
  useAnonTheme(anon);
  return (
    <div className="min-h-dvh text-fg">
      <header className="sticky top-0 z-30 px-3 pt-[max(0.5rem,var(--safe-top))]">
        <div
          className={cn(
            "glass-bar vt-topbar mx-auto flex items-center justify-between gap-3 rounded-[22px] py-1.5 pl-3 pr-1.5",
            WIDTHS[width],
          )}
        >
          <Wordmark to={viewer ? "/" : "/login"} />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {!viewer && (
              <Link to="/login" className="btn-ghost min-h-11 px-3 text-xs">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>
      <main
        className={cn(
          "mx-auto w-full px-4 pb-[calc(2rem+var(--safe-bottom))] pt-6 sm:px-6",
          WIDTHS[width],
        )}
      >
        {children}
      </main>
    </div>
  );
}

/** Students get their full shell on shared public pages; everyone else gets the public frame. */
export function AdaptiveShell({
  children,
  anon,
  width = "narrow",
}: {
  children: ReactNode;
  anon?: boolean;
  width?: keyof typeof WIDTHS;
}) {
  const viewer = useViewer();
  if (viewer?.role === "student") {
    return (
      <StudentShell anon={anon} width={width}>
        {children}
      </StudentShell>
    );
  }
  return (
    <PublicShell anon={anon} width={width}>
      {children}
    </PublicShell>
  );
}

/** Page title row used inside the student shell. */
export function PageHeading({
  eyebrow,
  title,
  subtitle,
  tone = "muted",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  tone?: "muted" | "violet";
}) {
  return (
    <header className="mb-6">
      {eyebrow && (
        <p
          className={cn(
            "text-xs font-semibold uppercase tracking-[0.18em]",
            tone === "violet" ? "text-violet" : "text-muted",
          )}
        >
          {eyebrow}
        </p>
      )}
      <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight md:text-3xl">
        {title}
      </h1>
      {subtitle && <div className="mt-2 text-sm text-muted">{subtitle}</div>}
    </header>
  );
}
