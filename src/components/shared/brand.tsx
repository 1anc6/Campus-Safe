import { Link } from "@tanstack/react-router";
import { Shield } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { tile: "size-8 rounded-lg", icon: "size-4" },
  md: { tile: "size-9 rounded-lg", icon: "size-5" },
  lg: { tile: "size-14 rounded-2xl", icon: "size-8" },
} as const;

/** The neon shield tile from the CampusSafe login, used across both shells. */
export function BrandMark({ size = "md" }: { size?: keyof typeof SIZES }) {
  const s = SIZES[size];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center bg-accent shadow-[0_0_14px_var(--neon-glow)]",
        s.tile,
      )}
    >
      <Shield className={cn("text-ink", s.icon)} strokeWidth={2.25} />
    </span>
  );
}

/** Brand lock-up linking to `to` (each shell passes its own home). */
export function Wordmark({
  to = "/",
  compact,
  caption,
}: {
  to?: string;
  compact?: boolean;
  caption?: string;
}) {
  return (
    <Link
      to={to}
      className="flex min-w-0 items-center gap-2.5 py-1"
      aria-label={`${BRAND.name} home`}
    >
      <BrandMark size={compact ? "sm" : "md"} />
      {!compact && (
        <span className="min-w-0">
          <span className="block truncate font-display text-[15px] font-semibold tracking-tight">
            {BRAND.name}
          </span>
          {caption && (
            <span className="block truncate font-mono text-[10px] tracking-wider text-dim">
              {caption}
            </span>
          )}
        </span>
      )}
    </Link>
  );
}
