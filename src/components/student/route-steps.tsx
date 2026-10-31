import {
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  Navigation,
  Undo2,
} from "lucide-react";
import { formatKm } from "@/lib/campus";
import { cn } from "@/lib/utils";
import type { RouteStep, TurnKind } from "@/lib/walk-route";

const ICONS: Record<TurnKind, typeof ArrowUp> = {
  depart: Navigation,
  straight: ArrowUp,
  left: CornerUpLeft,
  right: CornerUpRight,
  "slight-left": ArrowUpLeft,
  "slight-right": ArrowUpRight,
  "sharp-left": CornerUpLeft,
  "sharp-right": CornerUpRight,
  uturn: Undo2,
  arrive: Flag,
};

export function TurnIcon({ kind, className }: { kind: TurnKind; className?: string }) {
  const Icon = ICONS[kind];
  return <Icon className={className} aria-hidden="true" />;
}

/** Turn-by-turn list; the next manoeuvre is highlighted and passed ones are dimmed. */
export function RouteSteps({
  steps,
  next,
  className,
}: {
  steps: RouteStep[];
  /** The upcoming step, when you're walking the route. */
  next?: RouteStep | null;
  className?: string;
}) {
  const nextIdx = next ? steps.indexOf(next) : -1;
  return (
    <ol className={cn("space-y-1", className)} aria-label="Walking directions">
      {steps.map((s, i) => {
        const current = i === nextIdx;
        const passed = nextIdx > 0 && i < nextIdx;
        return (
          <li
            key={`${i}-${s.startM}`}
            aria-current={current ? "step" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-2.5 py-2 text-xs",
              current && "neu-well",
              passed && "opacity-45",
            )}
          >
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-lg",
                current || s.kind === "arrive" ? "bg-neon-dim text-neon" : "bg-panel-2 text-muted",
              )}
            >
              <TurnIcon kind={s.kind} className="size-3.5" />
            </span>
            <span className={cn("min-w-0 flex-1", current && "font-semibold")}>{s.text}</span>
            {s.kind !== "arrive" && s.distanceM >= 5 && (
              <span className="shrink-0 tabular-nums text-muted">{formatKm(s.distanceM)}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
