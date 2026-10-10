import { useState, useSyncExternalStore } from "react";
import { LogOut } from "lucide-react";
import { authEnabled, signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { roleLabel } from "@/lib/roles";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

const subscribeToNothing = () => () => {};
const noGateSessionOnServer = () => false;

/**
 * Sign out, then land on the shared login page. Hidden for gate-materialized
 * sessions (opened from Grok), where the next request signs the viewer straight
 * back in. Disabled while in flight; re-enabled if the server refuses.
 */
export function SignOutButton({ className, compact }: { className?: string; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const gateSession = useSyncExternalStore(
    subscribeToNothing,
    hasGateSessionMarker,
    noGateSessionOnServer,
  );
  if (!authEnabled || gateSession) return null;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void signOut("/login").catch(() => setBusy(false));
      }}
      className={cn(
        "inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-medium text-muted transition-colors hover:bg-panel hover:text-fg disabled:cursor-wait disabled:opacity-60",
        className,
      )}
      aria-label="Sign out"
    >
      <LogOut className="size-3.5" />
      {!compact && (busy ? "Signing out…" : "Sign out")}
    </button>
  );
}

export function Avatar({ profile, className }: { profile: Profile; className?: string }) {
  if (profile.avatarUrl) {
    return (
      <img
        src={profile.avatarUrl}
        alt=""
        className={cn("size-8 shrink-0 rounded-full object-cover", className)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full bg-neon-dim text-xs font-bold text-neon",
        className,
      )}
    >
      {(profile.name || profile.email || "?").charAt(0).toUpperCase()}
    </span>
  );
}

/** Identity card: avatar, name, role. */
export function IdentityCard({ profile }: { profile: Profile }) {
  return (
    <div className="flex min-w-0 items-center gap-3 px-2 py-2">
      <Avatar profile={profile} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-fg">{profile.name}</p>
        <p className="truncate font-mono text-[10px] text-dim">{roleLabel(profile.role)}</p>
      </div>
    </div>
  );
}
