import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Framed dashboard panel: fixed header, scrolling body. */
export function DashCard({
  title,
  badge,
  actions,
  toolbar,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  badge?: string;
  actions?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("card flex min-h-0 min-w-0 flex-col", className)}>
      <div className="flex min-h-14 items-center justify-between gap-2 border-b border-line px-4 py-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          {title}
          {badge && (
            <span className="rounded-full bg-panel-2 px-2 py-0.5 font-mono text-[11px] text-muted ring-1 ring-line">
              {badge}
            </span>
          )}
        </h2>
        {actions}
      </div>
      {toolbar && <div className="border-b border-line px-3 py-2.5 sm:px-4">{toolbar}</div>}
      <div className={cn("min-h-0 flex-1 overflow-y-auto p-3 sm:p-4", bodyClassName)}>{children}</div>
    </section>
  );
}
