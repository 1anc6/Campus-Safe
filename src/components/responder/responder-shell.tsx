import type { ReactNode } from "react";
import { SignOutButton } from "@/components/shared/account-menu";
import { Wordmark } from "@/components/shared/brand";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { useViewer } from "@/lib/auth/use-viewer";
import { cn } from "@/lib/utils";

/**
 * Frame for the responder field app (`/staff`): sticky top bar with a live
 * indicator, so a responder always knows the screen is updating on its own.
 */
export function ResponderShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const viewer = useViewer();
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-[600] border-b border-line bg-chrome/95 pt-safe backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <Wordmark to={viewer?.role === "admin" ? "/admin" : "/staff"} caption="RESPONDER" />
          <div className="flex items-center gap-1 sm:gap-2">
            <LiveDot className="hidden sm:inline-flex" />
            {viewer && (
              <span className="hidden max-w-40 truncate text-xs text-muted md:block">
                {viewer.name}
              </span>
            )}
            <ThemeToggle />
            <SignOutButton compact className="size-11 justify-center px-0" />
          </div>
        </div>
      </header>
      <main
        className={cn(
          "mx-auto w-full max-w-6xl px-4 pb-[calc(2rem+var(--safe-bottom))] pt-5 sm:px-6",
          className,
        )}
      >
        {children}
      </main>
    </div>
  );
}

export function LiveDot({ className, label = "Live" }: { className?: string; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center gap-2 rounded-full bg-ok/10 px-3 text-[11px] font-semibold text-ok ring-1 ring-ok/25",
        className,
      )}
    >
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-ok" />
      </span>
      {label}
    </span>
  );
}
