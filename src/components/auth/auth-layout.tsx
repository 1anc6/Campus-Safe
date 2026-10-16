import { Link } from "@tanstack/react-router";
import { EyeOff, ListChecks, Siren, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/shared/brand";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { BRAND } from "@/lib/brand";

/**
 * Frame shared by `/login` and `/signup`.
 *
 * Phones: a compact gradient brand header (theme toggle + "switch page" pill on
 * top) with the form in a rounded sheet sliding up from below, so the form gets
 * the screen instead of a card floating in a margin.
 * Desktop (lg+): the marketing hero on the left and the form in a card.
 */
export function AuthLayout({
  switchPrompt,
  switchLabel,
  switchTo,
  redirect,
  children,
}: {
  /** e.g. "Don't have an account?" */
  switchPrompt: string;
  switchLabel: string;
  switchTo: "/login" | "/signup";
  redirect?: string;
  children: ReactNode;
}) {
  return (
    <div className="auth-shell relative flex min-h-dvh flex-col overflow-hidden bg-[var(--auth-sheet)] lg:items-center lg:justify-center lg:bg-[var(--auth-page)] lg:px-4 lg:py-10">
      {/* Phone header */}
      <header className="relative px-4 pb-10 pt-[max(0.75rem,var(--safe-top))] text-fg lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <ThemeToggle />
          <p className="flex items-center gap-2 text-xs text-muted">
            <span className="hidden min-[360px]:inline">{switchPrompt}</span>
            <Link
              to={switchTo}
              search={{ redirect }}
              className="btn-ghost min-h-9 rounded-full px-4 text-xs text-neon"
            >
              {switchLabel}
            </Link>
          </p>
        </div>
        <div className="mt-7 flex flex-col items-center gap-2.5 text-center">
          <span className="neu-raised rounded-[22px] p-2.5">
            <BrandMark />
          </span>
          <p className="font-display text-[26px] font-bold tracking-tight">{BRAND.name}</p>
          <p className="text-xs text-muted">Help on campus, one hold away</p>
        </div>
      </header>

      {/* Desktop chrome */}
      <div className="absolute right-4 top-[max(1rem,var(--safe-top))] z-20 hidden lg:block">
        <ThemeToggle />
      </div>

      <div className="relative z-10 flex flex-1 flex-col lg:grid lg:w-full lg:max-w-5xl lg:flex-none lg:grid-cols-2 lg:items-center lg:gap-10">
        <section className="hidden lg:block" aria-hidden="true">
          <div className="mb-8 flex items-center gap-3">
            <BrandMark size="lg" />
            <div>
              <p className="font-display text-3xl font-bold">{BRAND.name}</p>
              <p className="neu-caps mt-1">Campus safety platform</p>
            </div>
          </div>
          <h2 className="mb-4 font-display text-5xl font-bold leading-tight">
            Making campuses
            <br />
            <span className="text-[var(--auth-link)]">safer together</span>
          </h2>
          <p className="mb-8 max-w-md text-lg text-muted">
            Raise an SOS, report incidents, follow every case — and run campus response from one
            console.
          </p>
          <ul className="max-w-md space-y-4">
            <Feature icon={Siren} tone="text-sos" title="Hold for help">
              Your SOS reaches campus command with your live location.
            </Feature>
            <Feature icon={EyeOff} tone="text-[var(--auth-link)]" title="Report anonymously">
              No account, just a tracking code to follow what happens.
            </Feature>
            <Feature icon={ListChecks} tone="text-[var(--auth-link)]" title="See every step">
              Follow each case from reported to resolved.
            </Feature>
          </ul>
        </section>

        <section className="mx-3 mb-[max(0.75rem,var(--safe-bottom))] flex-1 rounded-[28px] bg-[var(--auth-sheet)] px-5 shadow-[var(--neu-raised)] lg:mb-0 pb-[max(1.5rem,var(--safe-bottom))] pt-8 sm:px-8 lg:mx-auto lg:mt-0 lg:w-full lg:max-w-md lg:flex-none lg:rounded-[32px] lg:p-9 lg:shadow-[var(--neu-raised)]">
          <div className="mx-auto w-full max-w-md">{children}</div>
        </section>
      </div>
    </div>
  );
}

function Feature({
  icon: Icon,
  tone,
  title,
  children,
}: {
  icon: LucideIcon;
  tone: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex items-start gap-3.5">
      <span className="neu-raised mt-0.5 grid size-11 shrink-0 place-items-center rounded-2xl">
        <Icon className={`size-[18px] ${tone}`} />
      </span>
      <span>
        <span className="block font-display text-base font-semibold">{title}</span>
        <span className="block text-sm text-muted">{children}</span>
      </span>
    </li>
  );
}
