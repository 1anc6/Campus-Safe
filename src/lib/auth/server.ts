/**
 * Better Auth for this app (server-only): email + password sign-in.
 *
 * The app runs its own Better Auth at `/api/auth/*`, so the session cookie stays
 * on this app's own origin. Users and sessions live in the same Postgres
 * database as the app data — Neon when `DATABASE_URL` is set, otherwise the
 * embedded PGLite used for local development.
 *
 * Auth can be switched off for local experiments with `VITE_AUTH_ENABLED=false`:
 * `requireUserId` then resolves a dev user when no database is configured, and
 * fails closed once `DATABASE_URL` is set (see `verify.server.ts`).
 *
 * NEVER import this from client code — it pulls in `pg` and server-only Better
 * Auth internals. The browser uses `@/lib/auth/client`; components read the user
 * via `@/lib/auth/use-current-user`; server functions get a verified id via
 * `@/lib/auth/middleware`.
 */
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { bearer } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { ensureDbReady, getPglite } from "@/backend/db";
import { emailAndPasswordEnabled } from "./email-password";
import { pgliteDialect } from "./pglite-dialect";

// Start (and share) the PGLite bootstrap as soon as the auth module loads.
void ensureDbReady();

/**
 * Local-development signing secret. It must outlive dev-server module reloads:
 * the PGLite database (and its session rows) lives on `globalThis`, so a reload
 * of this file must not mint a new secret, or every session would break.
 * Production sets `BETTER_AUTH_SECRET` instead.
 */
const globalAuthRef = globalThis as typeof globalThis & { __devAuthSecret__?: string };
function devAuthSecret(): string {
  globalAuthRef.__devAuthSecret__ ??= randomBytes(32).toString("hex");
  return globalAuthRef.__devAuthSecret__;
}

/** Read an env var, treating empty/whitespace as unset. */
const env = (key: string): string | undefined => {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
};

// Explicit off-switch: set VITE_AUTH_ENABLED=false to run without sign-in.
const authDisabled = env("VITE_AUTH_ENABLED") === "false";

/** True when sign-in is active (real auth is enforced). */
export const authConfigured = !authDisabled && emailAndPasswordEnabled;

// This app's public origin. Production can pin it with BETTER_AUTH_URL;
// otherwise it is derived per request from the host, validated against the
// allow-list below.
const explicitBaseURL = env("BETTER_AUTH_URL");
// Local `npm run dev` (port 8080). Browsers may send any of these as the Origin
// for the same server — trusting only `localhost` would reject `127.0.0.1`.
const LOCAL_DEV_ORIGINS: string[] = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://[::1]:8080",
];
// On Vercel, the deployment's own addresses (production domain, branch and
// per-deploy preview URLs) arrive as system env vars — trust them automatically
// so sign-in works even before BETTER_AUTH_URL is configured.
const vercelHosts: string[] = [
  env("VERCEL_PROJECT_PRODUCTION_URL"),
  env("VERCEL_BRANCH_URL"),
  env("VERCEL_URL"),
].filter((h): h is string => Boolean(h));

const baseURL = explicitBaseURL ?? {
  allowedHosts: [...vercelHosts, "localhost", "127.0.0.1", "[::1]"],
  // `auto` → accept both http:// (local) and https:// (deployed).
  protocol: "auto" as const,
  fallback: vercelHosts[0] ? `https://${vercelHosts[0]}` : "http://localhost:8080",
};

/**
 * Origins Better Auth accepts on credentialed POSTs (sign-up/sign-in) — its
 * CSRF check. Missing entries surface as "Invalid origin". Besides the fixed
 * list, a request's Origin is accepted when its host is loopback, a private LAN
 * address (testing on a phone) or a VS Code / GitHub port-forward tunnel.
 */
function hostnameIsTrusted(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  if (
    host.endsWith(".devtunnels.ms") ||
    host.endsWith(".app.github.dev") ||
    host.endsWith(".githubpreview.dev")
  ) {
    return true;
  }
  if (/^10(?:\.\d{1,3}){3}$/.test(host)) return true;
  if (/^192\.168(?:\.\d{1,3}){2}$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}$/.test(host)) return true;
  return false;
}

const STATIC_TRUSTED_ORIGINS: string[] = [
  ...(explicitBaseURL ? [explicitBaseURL.replace(/\/+$/, "")] : []),
  ...vercelHosts.map((h) => `https://${h}`),
  ...LOCAL_DEV_ORIGINS,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

const trustedOrigins = async (request?: Request) => {
  const extra: string[] = [];
  const raw = request?.headers.get("origin") || "";
  if (raw && raw !== "null") {
    try {
      const url = new URL(raw);
      if (hostnameIsTrusted(url.hostname)) extra.push(url.origin);
    } catch {
      /* ignore malformed Origin */
    }
  }
  return [...STATIC_TRUSTED_ORIGINS, ...extra];
};

const databaseUrl = env("DATABASE_URL");

// Real Postgres when `DATABASE_URL` is set (deployed), else the embedded PGLite
// through a Kysely dialect — so users and sessions live in the SAME database as
// the app data. Schema: `migrations/0001_auth.sql`.
const database = databaseUrl
  ? new Pool({ connectionString: databaseUrl })
  : { dialect: pgliteDialect(() => getPglite()), type: "postgres" as const };

/** Session token cookie name. */
export const SESSION_TOKEN_COOKIE = "__Host-campussafe.session_token";

/**
 * Optional sign-up allow-list: `SIGNUP_ALLOWED_DOMAINS="gehu.ac.in,geu.ac.in"`
 * limits public student sign-up to campus email addresses, so outsiders can't
 * create accounts and raise SOS alerts. Unset = anyone may sign up (dev).
 * Admin-created and bootstrap accounts are not affected.
 */
const signupDomains = (env("SIGNUP_ALLOWED_DOMAINS") ?? "")
  .split(",")
  .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
  .filter(Boolean);

export const auth = betterAuth({
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email" || signupDomains.length === 0) return;
      const email = String(
        (ctx.body as { email?: unknown } | undefined)?.email ?? "",
      ).toLowerCase();
      const domain = email.split("@")[1] ?? "";
      if (!signupDomains.some((d) => domain === d || domain.endsWith(`.${d}`))) {
        throw APIError.from("FORBIDDEN", {
          message: `Use your campus email (${signupDomains.map((d) => `@${d}`).join(", ")}) to sign up.`,
          code: "EMAIL_DOMAIN_NOT_ALLOWED",
        });
      }
    }),
  },

  baseURL,
  secret: env("BETTER_AUTH_SECRET") ?? devAuthSecret(),
  database,

  // CSRF / origin check for credentialed auth POSTs (see `trustedOrigins` above).
  trustedOrigins,

  // Cache the session in a short-lived signed cookie so reads (incl. the
  // client's `/get-session`) skip the database and pages load without flicker.
  session: { cookieCache: { enabled: true, maxAge: 300 } },

  // Email/password — toggled via `./email-password`. Public self-registration
  // (`/signup`) always creates a `student`; elevated roles come only from admins
  // (Users page) or server-side bootstrap env vars (`src/backend/core/accounts.ts`).
  ...(emailAndPasswordEnabled ? { emailAndPassword: { enabled: true, minPasswordLength: 8 } } : {}),

  // `__Host-` prefixed cookies: the browser refuses any same-named cookie that
  // carries a `Domain` attribute, so no other site on a parent domain can plant
  // a session cookie for this app. `__Host-` requires Secure + Path=/ + no
  // Domain; Better Auth would otherwise use `__Secure-`, so we turn its prefix
  // off and set the names ourselves. (Browsers allow Secure cookies on
  // `http://localhost`, so local development still works.)
  advanced: {
    useSecureCookies: false,
    defaultCookieAttributes: { secure: true, sameSite: "lax", path: "/" },
    cookies: {
      session_token: { name: SESSION_TOKEN_COOKIE },
      session_data: { name: "__Host-campussafe.session_data" },
      account_data: { name: "__Host-campussafe.account_data" },
      dont_remember: { name: "__Host-campussafe.dont_remember" },
    },
  },

  plugins: [
    // Accept `Authorization: Bearer <session-token>` as an alternative to the
    // cookie — the fallback when a browser refuses the Secure cookie (e.g. the
    // app opened over plain http on a LAN address). Only active when an
    // Authorization header is present, so the normal cookie path is unaffected.
    bearer(),

    // Bridges Better Auth's Set-Cookie into TanStack Start responses. MUST be
    // last so it runs after every other plugin's hooks.
    tanstackStartCookies(),
  ],
});
