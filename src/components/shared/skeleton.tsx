import { cn } from "@/lib/utils";

/**
 * Shimmering loading placeholders shaped like the content they stand in for,
 * so the layout doesn't jump when data arrives.
 */

/** One shimmering block — size it with classes (h-4 w-32, size-10, …). */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("skeleton block", className)} />;
}

/** Wrapper that tells assistive tech the area is loading. */
export function SkeletonGroup({
  label = "Loading",
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={className}>
      {children}
    </div>
  );
}

/** A list row: tag/icon, two lines of text, a status pill. */
export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn("flex min-h-14 items-center gap-3 rounded-2xl p-3 neu-well", className)}>
      <Skeleton className="h-5 w-11 shrink-0 rounded-full" />
      <span className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-2.5 w-3/5" />
      </span>
      <Skeleton className="h-6 w-20 shrink-0 rounded-full" />
    </div>
  );
}

/** Several list rows. */
export function SkeletonList({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <SkeletonGroup className={cn("space-y-2", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </SkeletonGroup>
  );
}

/** A glass card with an icon, title, a few lines and a chip. */
export function SkeletonCard({ className, lines = 2 }: { className?: string; lines?: number }) {
  return (
    <div className={cn("card p-4", className)}>
      <div className="flex items-start gap-3">
        <Skeleton className="size-11 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1 space-y-2.5 pt-1">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          {Array.from({ length: lines }, (_, i) => (
            <Skeleton key={i} className={cn("h-3", i === lines - 1 ? "w-1/2" : "w-4/5")} />
          ))}
          <Skeleton className="h-5 w-10 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/** Page-level detail view: back link, title, a content card and a side card. */
export function SkeletonDetail({ withMap = false }: { withMap?: boolean }) {
  return (
    <SkeletonGroup label="Loading details" className="space-y-4">
      <Skeleton className="h-3 w-24" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-12 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-7 w-2/3 max-w-xs" />
      {withMap ? (
        <Skeleton className="h-72 w-full rounded-[22px] sm:h-96" />
      ) : (
        <div className="card space-y-2.5 p-5">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-11/12" />
          <Skeleton className="h-3.5 w-3/5" />
        </div>
      )}
      <div className="card space-y-3 p-5">
        <Skeleton className="h-3 w-20" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-6 shrink-0 rounded-full" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        ))}
      </div>
    </SkeletonGroup>
  );
}
