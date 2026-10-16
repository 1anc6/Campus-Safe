import { Moon, Sun } from "lucide-react";
import { setTheme, useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * Sun/moon switch for the whole app. Icons swap via the `dark:` variant (pure
 * CSS), so the server-rendered markup never mismatches a saved dark theme.
 */
export function ThemeToggle({ className, withLabel }: { className?: string; withLabel?: boolean }) {
  const theme = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      role="switch"
      aria-checked={theme === "dark"}
      suppressHydrationWarning
      aria-label="Dark mode"
      title={`Switch to ${next} mode`}
      className={cn(
        "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl text-muted neu-raised-xs transition-colors hover:bg-panel-2 hover:text-fg",
        withLabel && "w-full justify-start px-3",
        className,
      )}
    >
      <Sun className="size-[18px] dark:hidden" aria-hidden="true" />
      <Moon className="hidden size-[18px] dark:block" aria-hidden="true" />
      {withLabel && (
        <span className="text-xs font-medium">
          <span className="dark:hidden">Light mode</span>
          <span className="hidden dark:inline">Dark mode</span>
        </span>
      )}
    </button>
  );
}
