import { BrandMark } from "@/components/shared/brand";
import { BRAND } from "@/lib/brand";

/**
 * Loading screen while the session and role resolve. Access control itself lives
 * in route `beforeLoad` guards (`src/lib/auth/guards.ts`) and server functions.
 */
export function BootScreen() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <span className="animate-pulse">
          <BrandMark size="lg" />
        </span>
        <p className="font-display text-sm tracking-[0.2em] text-muted">
          {BRAND.name.toUpperCase()}
        </p>
        <span className="sr-only">Loading</span>
      </div>
    </div>
  );
}
