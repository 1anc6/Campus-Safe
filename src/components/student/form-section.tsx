import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Numbered form step card used by the student report forms. */
export function FormSection({
  step,
  title,
  hint,
  tone = "neon",
  children,
}: {
  step: number;
  title: string;
  hint?: string;
  tone?: "neon" | "violet";
  children: ReactNode;
}) {
  return (
    <section className="card p-4 sm:p-5">
      <header className="mb-4 flex items-start gap-3">
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-full font-mono text-xs font-bold",
            tone === "violet" ? "bg-violet/15 text-violet" : "bg-neon-dim text-neon",
          )}
          aria-hidden="true"
        >
          {step}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

/** Label/value line for the sticky summary panels. */
export function SummaryRow({ label, value, muted }: { label: string; value: ReactNode; muted?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className={cn("text-right font-medium", muted && "font-normal text-dim")}>{value}</span>
    </div>
  );
}
