// @ts-check
/**
 * The sign-out sequence used by `src/lib/auth/client.ts`, kept here as a pure
 * module so its effects can be unit-tested (`node --test` covers `scripts/`),
 * the same split `migration-plan.mjs` uses.
 *
 * The session rides an HttpOnly `__Host-` cookie that JavaScript cannot delete.
 * ONLY a completed sign-out response clears it, and `server.ts` enables
 * `session.cookieCache` (maxAge 300), so `/get-session` would keep answering
 * from the cached cookie for minutes afterwards. Redirecting on a timeout would
 * show the visitor "signed out" while their session is still live — so a
 * failed or timed-out sign-out throws instead of pretending.
 */

/**
 * Bounded so a wedged request reports a failure the visitor can retry instead
 * of spinning forever. A sign-out still unanswered at 10 s is not going to land.
 */
export const SIGN_OUT_TIMEOUT_MS = 10_000;

/**
 * Run `start()` but give up after `timeoutMs`, reporting which happened. Never
 * rejects — callers decide what a failure means, and a `try/catch` around an
 * `await` does nothing for a promise that never settles.
 * @param {() => unknown} start
 * @param {number} timeoutMs
 * @returns {Promise<"ok" | "failed" | "timeout">}
 */
export function settleWithin(start, timeoutMs) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve("timeout"), timeoutMs);
    /** @param {"ok" | "failed"} outcome */
    const done = (outcome) => {
      clearTimeout(timer);
      resolve(outcome);
    };
    try {
      Promise.resolve(start()).then(
        () => done("ok"),
        () => done("failed"),
      );
    } catch {
      done("failed");
    }
  });
}

/**
 * @typedef {object} SignOutSteps
 * @property {() => unknown} requestSignOut Ask the server to end the session; must reject on a failed response.
 * @property {() => void} clearToken Drop any stored bearer token.
 * @property {() => void} redirect Leave the page.
 * @property {number} [timeoutMs]
 */

/**
 * End the session, then clear the local token and redirect — but only once the
 * server has confirmed, because nothing else can clear the cookie.
 * @param {SignOutSteps} steps
 * @returns {Promise<void>}
 */
export async function runSignOut({ requestSignOut, clearToken, redirect, timeoutMs }) {
  const outcome = await settleWithin(requestSignOut, timeoutMs ?? SIGN_OUT_TIMEOUT_MS);
  if (outcome !== "ok") {
    throw new Error(
      outcome === "timeout"
        ? "Sign-out timed out — you are still signed in. Please try again."
        : "Sign-out failed — you are still signed in. Please try again.",
    );
  }
  clearToken();
  redirect();
}
