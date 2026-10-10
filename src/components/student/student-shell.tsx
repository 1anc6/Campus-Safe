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
        <div className="min-h-dvh bg-bg text-fg md:flex">
          <aside
            className="sticky top-0 hidden h-dvh w-[76px] shrink-0 flex-col border-r border-line bg-chrome md:flex 2xl:w-64"
            aria-label="Student sidebar"
          >
            <div className="flex h-[68px] items-center justify-center border-b border-line px-3 2xl:justify-start 2xl:px-4">
              <span className="2xl:hidden">
                <Wordmark to="/" compact />
              </span>
              <span className="hidden 2xl:block">
                <Wordmark to="/" caption="STUDENT SAFETY" />
              </span>
            </div>
            <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Student navigation">
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
                      "flex min-h-11 items-center justify-center gap-3 rounded-xl text-sm font-medium transition-colors 2xl:justify-start 2xl:px-3",
                      on
                        ? "nav-active bg-neon-dim text-fg"
                        : "text-muted hover:bg-panel-2 hover:text-fg",
                    )}
                  >
                    <t.icon className={cn("size-[18px] shrink-0", on ? "text-neon" : "text-dim")} />
                    <span className="hidden 2xl:inline">{t.label}</span>
                  </Link>
                );
              })}
              <div className="flex flex-col items-center gap-1 pt-4 2xl:flex-row 2xl:gap-3 2xl:px-1">
                <SosTrigger size="sm" className="mx-0" />
                <span className="hidden text-left 2xl:block">
                  <span className="block text-sm font-semibold text-sos">Emergency SOS</span>
                  <span className="block text-[11px] text-muted">Hold for 2 seconds</span>
                </span>
              </div>
            </nav>
            <div className="space-y-2 border-t border-line p-3">
              <a
                href={`tel:${SECURITY_LINE.phone.replaceAll(" ", "")}`}
                title={`Call ${SECURITY_LINE.label}: ${SECURITY_LINE.phone}`}
                aria-label={`Call ${SECURITY_LINE.label}, ${SECURITY_LINE.phone}`}
                className="flex min-h-11 items-center justify-center gap-3 rounded-xl bg-sos/10 ring-1 ring-sos/25 hover:bg-sos/15 2xl:justify-start 2xl:px-3 2xl:py-3"
              >
                <Phone className="size-4 shrink-0 text-sos" />
                <span className="hidden min-w-0 2xl:block">
                  <span className="block text-xs font-semibold text-fg">{SECURITY_LINE.label}</span>
                  <span className="block font-mono text-[11px] text-muted">
                    {SECURITY_LINE.phone}
                  </span>
                </span>
              </a>
              <span className="block 2xl:hidden">
                <ThemeToggle className="w-full" />
              </span>
              <span className="hidden 2xl:block">
                <ThemeToggle withLabel />
              </span>
              <span className="flex justify-center 2xl:hidden">
                <ProfileButton />
              </span>
              <span className="hidden 2xl:block">
                <ProfileButton withName />
              </span>
              <span className="block 2xl:hidden">
                <SignOutButton compact className="w-full justify-center px-0" />
              </span>
              <span className="hidden 2xl:block">
                <SignOutButton className="w-full" />
              </span>
            </div>
          </aside>

          <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-30 border-b border-line bg-chrome/95 pt-safe backdrop-blur-md md:hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-2">
                <Wordmark to="/" />
                {/* Sign-out and settings live in the profile panel behind the avatar. */}
                <div className="flex items-center gap-1">
                  <ThemeToggle />
                  <ProfileButton />
                </div>
              </div>
            </header>

            <main
              className={cn(
                "mx-auto flex w-full flex-1 flex-col px-4 pt-4 sm:px-6 md:px-6 md:pb-8 md:pt-6 xl:px-8",
                "pb-[calc(7rem+var(--safe-bottom))]",
                WIDTHS[width],
              )}
            >
              {children}
            </main>
          </div>

          <nav
            className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-chrome/95 pb-safe backdrop-blur-md md:hidden"
            aria-label="Student navigation"
          >
            <ul className="mx-auto grid max-w-lg grid-cols-5">
              {TABS.slice(0, 2).map((t) => (
                <TabLink key={t.to} tab={t} on={tabActive(pathname, t.to)} />
              ))}
              {/* SOS rides up out of the bar so it is the biggest target on screen. */}
              <li className="relative flex justify-center">
                <span className="absolute -top-10 rounded-full bg-chrome p-1 ring-1 ring-line">
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
          "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium",
          on ? "text-neon" : "text-muted",
        )}
      >
        <tab.icon className="size-5" />
        {tab.label}
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
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-30 border-b border-line bg-chrome/95 pt-safe backdrop-blur-md">
        <div
          className={cn(
            "mx-auto flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6",
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
