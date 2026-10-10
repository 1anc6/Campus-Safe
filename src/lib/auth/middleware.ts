import { createMiddleware } from "@tanstack/react-start";

/**
 * Auth middleware for server functions — the standard way to get the caller's
 * verified user id. The session cookie is same-origin and rides along
 * automatically; if the browser refused the cookie, the `.client` hook below
 * forwards the stored bearer token instead — call sites never thread it.
 *
 *   import { createServerFn } from "@tanstack/react-start";
 *   import { getSql } from "@/backend/db";
 *   import { authMiddleware } from "@/lib/auth/middleware";
 *
 *   export const listTodos = createServerFn({ method: "GET" })
 *     .middleware([authMiddleware])
 *     .handler(async ({ context }) => {
 *       const sql = await getSql();
 *       return sql`select * from todos where user_id = ${context.userId}`;
 *     });
 *
 * Signed out -> throws `UnauthorizedError` (see `verify.server.ts`). With auth
 * disabled (`VITE_AUTH_ENABLED=false`) it resolves a shared dev user — but
 * throws instead when a `DATABASE_URL` is also set. Use it on every server
 * function that touches per-user data and scope every query by
 * `context.userId`.
 */
export const authMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    // Cookie fallback: forward a stored bearer token, if any. Normally null, so
    // this is a no-op and the cookie is used.
    const { getBearerToken } = await import("./client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    // ONLY import `*.server` modules here. This file runs on both client and
    // server; the `.server` suffix keeps server-only code out of the browser.
    const { assertSameSiteRequest } = await import("./isolation.server");
    const { requireUserId } = await import("./verify.server");
    // Reject scripted cross-site requests before touching per-user data.
    assertSameSiteRequest();
    const userId = await requireUserId(context.bearerToken);
    return next({ context: { userId } });
  });

/**
 * Like `authMiddleware`, but a signed-out caller is not an error: `context.userId`
 * is `null`. Used only to resolve who is visiting (route guards, the login page);
 * anything that reads or writes data must use `authMiddleware`.
 */
export const optionalAuthMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("./client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    const { assertSameSiteRequest } = await import("./isolation.server");
    const { getSessionUser } = await import("./verify.server");
    assertSameSiteRequest();
    const user = await getSessionUser(context.bearerToken);
    return next({ context: { userId: user?.id ?? null } });
  });
