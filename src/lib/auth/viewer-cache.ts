import type { Profile } from "@/lib/types";

/**
 * Browser-side memory of "who is signed in", so moving between pages doesn't
 * wait on a server round trip every time.
 *
 * Only route guards (which pages to show) use this; every server function still
 * checks the session and role itself on each call, so a stale entry can never
 * grant access to data. Sign-out reloads the page, which clears it; sign-in and
 * profile edits call `forgetViewer()` before refreshing.
 */
const TTL_MS = 30_000;
let cached: { viewer: Profile; at: number } | null = null;

export function rememberedViewer(): Profile | null {
  if (!cached || Date.now() - cached.at > TTL_MS) return null;
  return cached.viewer;
}

export function rememberViewer(viewer: Profile | null) {
  // Only remember signed-in users: a signed-out result must be re-checked so
  // signing in takes effect immediately.
  cached = viewer ? { viewer, at: Date.now() } : null;
}

export function forgetViewer() {
  cached = null;
}
