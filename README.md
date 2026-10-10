# CampusSafe — unified Campus Safety app

One application for students and campus administrators, merged from the
**Campus Safety Student** (base: TanStack Start, Better Auth, Postgres) and
**Campus Safety Admin** (login design, admin layout, incident filters/detail, user
management) projects.

Everyone signs in on the same page, `/login`. The account's role decides where they
land and what they can do.

| Role        | Lands on  | Experience                                                                                     |
| ----------- | --------- | ---------------------------------------------------------------------------------------------- |
| `student`   | `/`       | Hold-to-send SOS with live location, report incidents, anonymous reports, report history/tracking |
| `admin`     | `/admin`  | Operations console: live dashboard, SOS, incidents, anonymous reports, users, responders, analytics |
| `responder` | `/staff`  | Field app for SOS alerts assigned to their unit (kept from the base project)                   |

Public without an account: `/anonymous` (anonymous report) and `/track/<code>` (follow it).

## Quick start (local)

```bash
npm ci
export BOOTSTRAP_ADMIN_EMAIL=admin@campus.test BOOTSTRAP_ADMIN_PASSWORD='choose-a-long-password'
npm run dev   # http://localhost:8080
```

Or keep them in a git-ignored `.env.local.example` (`KEY=value` lines) and run
`npm run dev:local`, which loads that file automatically (any terminal, incl. PowerShell).

Without `DATABASE_URL` the app uses an embedded PGLite database (in memory; it
resets when the dev server restarts) and loads sample campus incidents for demos.

## Accounts and roles

Public self-registration is **disabled**. Password accounts come from:

1. **Bootstrap env vars** (server-side only), created on first visit to `/login`:

   | Variable                                          | Purpose                           |
   | ------------------------------------------------- | --------------------------------- |
   | `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` | First admin account (required to administer a fresh install) |
   | `BOOTSTRAP_ADMIN_NAME`                            | Optional display name             |
   | `BOOTSTRAP_STUDENT_EMAIL`, `BOOTSTRAP_STUDENT_PASSWORD`, `BOOTSTRAP_STUDENT_NAME` | Optional demo student |

   Passwords must be at least 8 characters. Existing passwords are never reset;
   the role is re-asserted on each server start.

2. **Admins → Users → New account**: create a student, responder or admin with a
   temporary password, and change roles later (an admin cannot change their own role).

3. **Google / X sign-in** (via the Grok auth broker), when configured. New
   federated accounts start as `student`.

## How access control works

- `profiles.role` (`student | responder | admin`) is the single role source.
- `getViewer` (`src/lib/server/viewer.ts`) resolves the session and reads the role
  from the database on every navigation; the root route exposes it as `context.viewer`.
- Route guards (`src/lib/auth/guards.ts`) run in `beforeLoad`, on the server for
  direct URLs/refreshes and on the client for in-app navigation:
  - `/admin/*` → admins only; anyone else gets `/forbidden`.
  - `/`, `/report`, `/reports/*`, `/sos/*` → students; other roles are sent to their home.
  - `/staff/*` → responders and admins.
  - Signed out → `/login?redirect=<path>`; after sign-in the user returns there if
    their role allows it (`src/lib/roles.ts`), otherwise to their role's home.
- Every privileged server function re-checks the role (`requireAdmin`,
  `requireStaff` in `src/lib/server/helpers.ts`); responders can only see and update
  SOS alerts assigned to their unit. Hiding a link is never the only protection.

## Scripts

| Command             | What it does                                       |
| ------------------- | -------------------------------------------------- |
| `npm run dev`       | Dev server on :8080                                |
| `npm run build`     | Production build (Vercel preset) + migrations when `DATABASE_URL` is set |
| `npm run typecheck` | TypeScript                                         |
| `npm run lint`      | ESLint                                             |
| `npm test`          | Unit tests (incl. `src/lib/roles.test.ts`)         |

## Live GPS tracking

- When a student holds SOS, the phone's GPS position is sent with the alert, then the
  SOS screen streams updates (every ~7 s while moving, a heartbeat every 20 s when still).
- Admins see each live alert on **SOS Alerts**: position, accuracy circle, movement trail,
  "updated Xs ago", and a *signal lost* warning after 60 s without an update.
- **Browsers only allow GPS on HTTPS or `localhost`.** On a phone opening
  `http://192.168.x.x:8080`, location is blocked and the app says so. Test on phones via
  the deployed HTTPS site or an HTTPS tunnel (e.g. VS Code port forwarding / dev tunnels).
- Tracking runs while the SOS screen is open; mobile browsers pause it if the screen is
  locked or the app is backgrounded (the screen is kept awake with the Wake Lock API).
- Campus map and locations: Graphic Era (Deemed to be) University, Clement Town, Dehradun,
  from OpenStreetMap (`src/lib/campus.ts`, `migrations/0004_graphic_era_campus.sql`).

## Production setup

- `DATABASE_URL` (Postgres/Neon) — **required**. The production server bundle does not
  run on the embedded PGLite fallback. Migrations in `migrations/` apply during
  `npm run build`, including `0003_student_role.sql` (renames `citizen` → `student`).
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` — required for stable sessions.
- `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` — first admin.
- `SEED_SAMPLE_DATA=true` — only if you want demo incidents in a real database.
- Map tiles: `src/components/live-map.tsx` uses keyless OpenStreetMap tiles (darkened in CSS).
  For heavy production traffic use a tile provider with an API key — OSM's public tiles have a
  fair-use policy.
- Security desk number in the student shell comes from `RESPONDER_UNITS[0]` in
  `src/lib/campus.ts`. Set it to your real campus security line.
