import { Link } from "@tanstack/react-router";
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
    <div className="relative flex min-h-dvh flex-col overflow-hidden lg:items-center lg:justify-center lg:px-4 lg:py-10">
      {/* Phone header */}
      <header className="relative bg-[linear-gradient(135deg,#0e7490_0%,#4f46b8_100%)] px-4 pb-12 pt-[max(0.75rem,var(--safe-top))] text-white lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <ThemeToggle className="text-white/85 ring-white/25 hover:bg-white/10 hover:text-white" />
          <p className="flex items-center gap-2 text-xs text-white/80">
            <span className="hidden min-[360px]:inline">{switchPrompt}</span>
            <Link
              to={switchTo}
              search={{ redirect }}
              className="inline-flex min-h-9 items-center rounded-lg bg-white/15 px-3 text-xs font-semibold text-white ring-1 ring-white/25 hover:bg-white/25"
            >
              {switchLabel}
            </Link>
          </p>
        </div>
        <div className="mt-6 flex flex-col items-center gap-2 text-center">
          <BrandMark />
          <p className="font-display text-2xl font-bold">{BRAND.name}</p>
          <p className="font-mono text-[10px] tracking-wider text-white/70">
            CAMPUS SAFETY PLATFORM
          </p>
        </div>
      </header>

      {/* Desktop chrome */}
      <div className="absolute right-4 top-[max(1rem,var(--safe-top))] z-20 hidden lg:block">
        <ThemeToggle className="bg-panel" />
      </div>
      <div className="pointer-events-none fixed left-20 top-16 hidden size-96 rounded-full bg-neon opacity-[0.16] blur-3xl lg:block" />
      <div className="pointer-events-none fixed bottom-16 right-20 hidden size-96 rounded-full bg-violet opacity-[0.16] blur-3xl lg:block" />

      <div className="relative z-10 flex flex-1 flex-col lg:grid lg:w-full lg:max-w-5xl lg:flex-none lg:grid-cols-2 lg:items-center lg:gap-10">
        <section className="hidden lg:block" aria-hidden="true">
          <div className="mb-8 flex items-center gap-3">
            <BrandMark size="lg" />
            <div>
              <p className="font-display text-3xl font-bold">{BRAND.name}</p>
              <p className="font-mono text-xs tracking-wider text-dim">CAMPUS SAFETY PLATFORM</p>
            </div>
          </div>
          <h2 className="mb-4 font-display text-5xl font-bold leading-tight">
            Making campuses
            <br />
            <span className="text-neon [text-shadow:0_0_20px_var(--neon-glow)]">
              safer together
            </span>
          </h2>
          <p className="mb-8 max-w-md text-lg text-muted">
            Raise an SOS, report incidents, follow every case — and run campus response from one
            console.
          </p>
          <div className="grid max-w-md grid-cols-3 gap-4">
            <Stat value="24/7" label="Monitoring" tone="text-neon" />
            <Stat value="100%" label="Anonymous option" tone="text-violet" />
            <Stat value="SOS" label="Hold for help" tone="text-sos" />
          </div>
        </section>

        <section className="-mt-6 flex-1 rounded-t-3xl bg-panel px-5 pb-[max(1.5rem,var(--safe-bottom))] pt-7 sm:px-8 lg:mx-auto lg:mt-0 lg:w-full lg:max-w-md lg:flex-none lg:rounded-[28px] lg:border lg:border-[var(--glass-border)] lg:p-8 lg:shadow-[var(--glass-shadow)] lg:backdrop-blur-2xl">
          <div className="mx-auto w-full max-w-md">{children}</div>
        </section>
      </div>
    </div>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone: string }) {
  return (
    <div className="card p-4 text-center">
      <p className={`font-display text-2xl font-bold ${tone}`}>{value}</p>
      <p className="mt-1 text-xs text-dim">{label}</p>
    </div>
  );
}
