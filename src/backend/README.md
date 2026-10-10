# Backend

Code in this folder runs **only on the server** — the browser never receives it.

- **`functions/`** — the app's API. Each `createServerFn(...)` here can be called
  from a page like a normal function; the framework turns the call into an HTTPS
  request. Every function checks *who* is calling, *whether they're allowed*, and
  *validates the input* before touching the database.
- **`core/`** — internal helpers used by the functions (role checks, audit log,
  account creation, rate limiting, demo data). Not callable from the browser.
- **`db.ts`** — the database connection: Neon Postgres when `DATABASE_URL` is set,
  otherwise an in-memory PGLite database for local development.

Sign-in itself is handled by Better Auth: `src/lib/auth/server.ts`, exposed at
`/api/auth/*` by `src/routes/api/auth/$.ts`.
