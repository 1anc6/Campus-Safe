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
      <header className="relative bg-[image:var(--auth-hero)] px-4 pb-14 pt-[max(0.75rem,var(--safe-top))] text-[var(--auth-hero-fg)] lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <ThemeToggle className="text-white/80 ring-white/20 hover:bg-white/10 hover:text-white" />
          <p className="flex items-center gap-2 text-xs text-[var(--auth-hero-muted)]">
            <span className="hidden min-[360px]:inline">{switchPrompt}</span>
            <Link
              to={switchTo}
              search={{ redirect }}
              className="inline-flex min-h-9 items-center rounded-full bg-white px-4 text-xs font-semibold text-[#0a3446] shadow-sm transition-colors hover:bg-white/90"
            >
              {switchLabel}
            </Link>
          </p>
        </div>
        <div className="mt-7 flex flex-col items-center gap-2.5 text-center">
          <span className="rounded-[18px] bg-white/10 p-1.5 ring-1 ring-white/15">
            <BrandMark />
          </span>
          <p className="font-display text-[26px] font-bold tracking-tight">{BRAND.name}</p>
          <p className="text-xs text-[var(--auth-hero-muted)]">Help on campus, one hold away</p>
        </div>
      </header>

      {/* Desktop chrome */}
      <div className="absolute right-4 top-[max(1rem,var(--safe-top))] z-20 hidden lg:block">
        <ThemeToggle className="bg-panel" />
      </div>
      <div className="pointer-events-none fixed left-20 top-16 hidden size-96 rounded-full bg-[var(--auth-cta)] opacity-[0.12] blur-3xl lg:block" />
      <div className="pointer-events-none fixed bottom-16 right-20 hidden size-96 rounded-full bg-[#0f7480] opacity-[0.12] blur-3xl lg:block" />

      <div className="relative z-10 flex flex-1 flex-col lg:grid lg:w-full lg:max-w-5xl lg:flex-none lg:grid-cols-2 lg:items-center lg:gap-10">
        <section className="hidden lg:block" aria-hidden="true">
          <div className="mb-8 flex items-center gap-3">
            <BrandMark size="lg" />
            <div>
              <p className="font-display text-3xl font-bold">{BRAND.name}</p>
              <p className="font-mono text-xs tracking-wider text-muted">CAMPUS SAFETY PLATFORM</p>
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

        <section className="-mt-7 flex-1 rounded-t-[28px] bg-[var(--auth-sheet)] px-5 pb-[max(1.5rem,var(--safe-bottom))] pt-8 sm:px-8 lg:mx-auto lg:mt-0 lg:w-full lg:max-w-md lg:flex-none lg:rounded-[28px] lg:border lg:border-[var(--auth-field-border)] lg:p-8 lg:shadow-[0_24px_60px_-24px_rgb(10_52_70/0.35)]">
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
      <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--auth-sheet)] ring-1 ring-[var(--auth-field-border)]">
        <Icon className={`size-[18px] ${tone}`} />
      </span>
      <span>
        <span className="block font-display text-base font-semibold">{title}</span>
        <span className="block text-sm text-muted">{children}</span>
      </span>
    </li>
  );
}
