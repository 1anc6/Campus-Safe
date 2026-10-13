# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Students** at Graphic Era (Deemed to be) University, Dehradun. They need help fast on campus (often scared, often on a phone, sometimes in poor light or poor signal), want to report something that happened, or want to report it without revealing who they are.
- **Campus command / university administration** (role `admin`). They watch live SOS, incident and anonymous queues, manage users and responders, and read analytics. They decide whether the campus runs on CampusSafe.
- **Responders** (role `responder`) receive assigned SOS alerts on a field view, navigate to the student, call them and update status. Accounts are created by an admin.

## Product Purpose

CampusSafe helps students get help fast on campus and gives campus command one live picture of everything happening. Success: a student in trouble reaches a responder in seconds with their live location, and every report reaches someone who acts on it.

## Positioning

A safety loop built for one specific campus: the student's hold-to-send SOS carries live GPS onto a map of Graphic Era's own buildings and gates, command sees it on a live console, and an assigned responder's status flows back to the student step by step (Sent → Received → Responder assigned → Arriving → Resolved). Anonymous reports can be filed and tracked with a code, with no account.

## Operating Context

- Students: installable web app (Add to Home Screen), phone-first, GPS needs HTTPS. Routes `/` (home with SOS), `/report`, `/reports`, `/anonymous`, `/track/<code>`, `/signup`, `/login`.
- Admins: desktop console at `/admin` (live dashboard, SOS / incidents / anonymous queues, users, responders, analytics).
- Responders: field app at `/staff`.
- Campus map: OpenStreetMap, real building coordinates in `src/lib/campus.ts` (Gate 1, Gate 2, CS-IT Block, B.Tech Block, Aryabhatt Computer Center, Chanakya Block, ...).

## Capabilities and Constraints

- Hold-to-send SOS with live location; SOS status stepper; medical ID on profile.
- Incident reports with photo, categories (harassment, theft, medical, fire, infrastructure, ragging, suspicious, accident, other) and severity P1–P4.
- Anonymous reports (victim / witness / heard) tracked by code, no account.
- Safe Walk feature and campus alerts exist in the student app.
- Students self-register at `/signup`; responders/admins are created by an admin.
- Stack: React 19, TanStack Start/Router, Tailwind CSS 4, Leaflet, Better Auth, PostgreSQL (Neon / PGLite), hosted on Vercel.
- Open: whether the university has formally adopted it (treat as not yet; do not claim adoption).

## Brand Commitments

- Name **CampusSafe**; shield mark (`src/components/shared/brand.tsx`); tagline "Making campuses safer together"; existing app world: liquid-glass panels over an aurora, cyan/neon accent, SOS red, violet for anonymous flows, light and dark themes.

## Evidence on Hand

- Real: the working app, its flows and screens, the campus building list and map, OG image `public/og.jpg`.
- Absent, must not be fabricated: testimonials, user counts, response-time statistics, university endorsement, uptime or "24/7 monitoring" guarantees, press.

## Product Principles

1. Seconds matter: the path to help is never more than one deliberate action away.
2. Every report lands somewhere: the student always sees what happened next.
3. Anonymity is real, not a checkbox: no account, a tracking code, nothing tying it back.
4. One campus, known precisely: real places, real routes, not a generic safety app.

## Accessibility & Inclusion

Used under stress and on phones: large targets, high contrast in both themes, reduced-motion respected, no meaning carried by colour alone. Target WCAG 2.2 AA.
