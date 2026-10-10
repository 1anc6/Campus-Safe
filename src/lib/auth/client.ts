import { createAuthClient } from "better-auth/react";
import { runSignOut } from "../../../scripts/sign-out-plan.mjs";

/**
 * Better Auth client for the browser.
 *
 * Talks to this app's own Better Auth at same-origin `/api/auth/*`. Normally the
 * session rides an HttpOnly cookie. When a browser refuses that Secure cookie
 * (e.g. the app opened over plain http on a LAN address), the login page stores
 * the session token instead and the `onRequest` hook below sends it as a bearer
 * token. When no token is stored, nothing changes.
 *
 * To sign out call `signOut()` below, NOT `authClient.signOut()`: the raw call
 * leaves a stored bearer token in place, and `onRequest` keeps re-attaching it,
 * so the visitor would stay signed in.
 */
export const authClient = createAuthClient({
  fetchOptions: {
    onRequest(ctx) {
      const token = getBearerToken();
      if (token) ctx.headers.set("Authorization", `Bearer ${token}`);
      return ctx;
    },
  },
});

/** False only when sign-in is switched off with `VITE_AUTH_ENABLED=false`. */
export const authEnabled = import.meta.env.VITE_AUTH_ENABLED !== "false";

// ── Bearer-token fallback ────────────────────────────────────────────────────
// Kept in sessionStorage (cleared when the tab closes) and attached to every
// Better Auth request and server function (via `@/lib/auth/middleware`).
const BEARER_KEY = "campussafe.bearer-token";

/** The stored fallback session token, or null. */
export function getBearerToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(BEARER_KEY);
  } catch {
    return null;
  }
}

function setBearerToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) window.sessionStorage.setItem(BEARER_KEY, token);
    else window.sessionStorage.removeItem(BEARER_KEY);
  } catch {
    /* storage unavailable — ignore */
  }
}

/** Store the session token returned by email sign-in (cookie fallback). */
export function applySessionToken(token: string | null): void {
  setBearerToken(token);
}

/**
 * Sign out of this app's session, clear any stored token, then redirect.
 *
 * Use this, never `authClient.signOut()` — see the note on `authClient`.
 * Sequencing lives in `scripts/sign-out-plan.mjs` so it can be unit-tested.
 *
 * **Rejects if the server never confirms.** The session is an HttpOnly cookie
 * only the server can clear, so redirecting anyway would report a sign-out that
 * did not happen; the caller re-enables its button so the visitor can retry.
 */
export async function signOut(redirectTo = "/"): Promise<void> {
  await runSignOut({
    // Better Auth resolves with `{ error }` instead of rejecting, so surface a
    // failed response as a rejection for the sequence to act on.
    requestSignOut: async () => {
      const { error } = await authClient.signOut();
      if (error) throw new Error(error.message ?? "Sign-out failed");
    },
    clearToken: () => setBearerToken(null),
    redirect: () => {
      window.location.href = redirectTo;
    },
  });
}
