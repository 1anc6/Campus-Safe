# CampusSafe — Campus Safety Platform

A web app that helps students get help fast on campus. Students can raise a
**hold-to-send SOS** with live GPS, **report incidents** (with a photo), or file an
**anonymous report**. Campus command watches everything live from an **admin
console**, and **responders** get their assigned alerts on a field app.

Built for Graphic Era (Deemed to be) University, Dehradun.

> New here? Read **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — it explains
> every folder, how a request travels from the screen to the database, and where
> the Operating System and DBMS concepts live.

## Who uses it

| Role        | Lands on | What they can do |
| ----------- | -------- | ---------------- |
| `student`   | `/`      | Hold SOS (live location), report incidents, anonymous reports, track their cases, profile & medical ID |
| `responder` | `/staff` | See SOS alerts assigned to them, navigate, call the student, update status |
| `admin`     | `/admin` | Live dashboard, SOS / incidents / anonymous queues, users, responders, analytics |

No account needed: `/anonymous` (file an anonymous report) and `/track/<code>` (follow it).

## Tech stack

| Layer | Technology |
| ----- | ---------- |
| Frontend | React 19, TanStack Router (pages), Tailwind CSS (styling), Leaflet + OpenStreetMap (maps) |
| Backend | TanStack Start server functions on Node.js, Better Auth (sign-in, sessions) |
| Database | PostgreSQL — **Neon** in production, embedded **PGLite** for local development |
| Hosting | Vercel |

## Project structure (short version)

```
campus-safe/
├── src/
│   ├── routes/        FRONTEND  pages — the file path is the URL
│   ├── components/    FRONTEND  reusable UI, grouped by who uses it
│   ├── backend/       BACKEND   server functions + database connection
│   ├── lib/           SHARED    types, campus data, helpers, auth
│   └── styles.css     global styles & theme colours
├── migrations/        DATABASE  SQL files that create/upgrade the tables
├── public/            static files (icons, images)
├── scripts/           build / migration / tooling scripts
├── server/            hosting middleware (install page, share card)
└── docs/              documentation
```

Full map with every file: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Run it locally

```bash
npm ci
npm run dev:local
```

Open http://localhost:8080. `dev:local` loads the test accounts from
`.env.local.example` (an admin and a student). Without `DATABASE_URL` the app uses an
in-memory database that resets every time the server restarts.

To use a real **Neon** database locally, put `DATABASE_URL=...` in a `.env.local`
file (git-ignored), then:

```bash
node --env-file=.env.local scripts/migrate.mjs
node --env-file=.env.local scripts/with-app-env.mjs vite dev --host 0.0.0.0 --port 8080
```

## Accounts

- **Students** sign up themselves at `/signup` (always as `student`).
  Set `SIGNUP_ALLOWED_DOMAINS=yourcollege.ac.in` to allow only campus emails.
- **Responders and admins** are created by an admin on **Admin → Users**.
- The **first admin** comes from `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD`.

## Environment variables

| Variable | Needed for | Purpose |
| -------- | ---------- | ------- |
| `DATABASE_URL` | production | Neon Postgres connection string (use the *pooled* one) |
| `BETTER_AUTH_SECRET` | production | Long random string that signs sessions |
| `BETTER_AUTH_URL` | production | Public site URL, e.g. `https://campus-safe.vercel.app` |
| `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` | first run | Creates the first admin account |
| `SIGNUP_ALLOWED_DOMAINS` | optional | Comma-separated email domains allowed to sign up |
| `SEED_SAMPLE_DATA` | optional | `true` loads demo incidents into a real database |

## Commands

| Command | What it does |
| ------- | ------------ |
| `npm run dev` / `npm run dev:local` | Start the dev server on port 8080 (`dev:local` adds test accounts) |
| `npm run build` | Production build for Vercel, then applies database migrations |
| `npm run typecheck` | TypeScript type check |
| `npm run lint` | ESLint |
| `npm test` | Unit tests |

## Deploy (GitHub → Vercel)

1. Push this repo to GitHub.
2. On vercel.com: **Add New → Project → Import** the repo.
3. Add the environment variables above (at least `DATABASE_URL`, `BETTER_AUTH_SECRET`,
   `BETTER_AUTH_URL`, and the bootstrap admin).
4. **Deploy.** The build creates the database tables automatically; every later
   `git push` redeploys.

## Notes

- Browsers only allow GPS on **HTTPS** (or `localhost`) — test location on phones
  through the deployed site.
- Campus security phone number: `RESPONDER_UNITS` in `src/lib/campus.ts`.
- Map tiles are free OpenStreetMap tiles; heavy production traffic should use a tile
  provider with an API key.
