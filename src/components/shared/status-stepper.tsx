import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export function StatusStepper({
  steps,
  current,
}: {
  steps: { id: string; label: string }[];
  current: string;
}) {
  const idx = Math.max(
    0,
    steps.findIndex((s) => s.id === current),
  );
  const done = current === "resolved" || current === "cancelled" || current === "closed";
  return (
    <ol className="flex flex-col gap-0">
      {steps.map((step, i) => {
        const active = i === idx && !done;
        // Ticks stop at the current step: a resolved incident leaves "Closed" open
        // until command closes it.
        const complete = i < idx || (done && i <= idx);
        const reached = i <= idx;
        return (
          <li key={step.id} className="flex gap-3" aria-current={active ? "step" : undefined}>
            <div className="flex flex-col items-center" aria-hidden="true">
              <span
                className={cn(
                  "grid size-6 place-items-center rounded-full text-[10px] font-bold",
                  complete
                    ? "bg-ok text-ink"
                    : active
                      ? "bg-accent text-on-accent"
                      : "text-muted neu-well",
                )}
              >
                {complete ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              {i < steps.length - 1 && (
                <span className={cn("w-px flex-1 min-h-5", reached ? "bg-neon/40" : "bg-line")} />
              )}
            </div>
            <div className={cn("pb-4", i === steps.length - 1 && "pb-0")}>
              <p
                className={cn(
                  "text-sm font-medium leading-6",
                  active ? "text-fg" : complete ? "text-fg" : "text-muted",
                )}
              >
                {step.label}
                {/* The tick and colour show progress visually; say it in words too. */}
                <span className="sr-only">
                  {complete ? " (done)" : active ? " (current step)" : " (not yet)"}
                </span>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
