# CampusSafe accessibility check (WCAG 2.2 AA) — interim

Status: **in progress.** The fixes below are committed. The automated scan has not yet been re-run
after the fixes, so the "after" column is still open.

## Method

- `npm run a11y` (`scripts/a11y-audit.mjs`): axe-core 4 through Playwright, tags wcag2a/aa,
  wcag21a/aa, wcag22aa and best-practice. It checks every page for public, student, responder and
  admin users, in light and dark themes, at 360px and 1280px, with reduced motion turned on. It also
  checks opened states: onboarding, SOS countdown, profile panel, bell, form errors and the command
  palette. Run the dev server first. Set `A11Y_BASE_URL` if it is not on port 8080.
- Manual checks done so far, using scripted Playwright: the SOS button with keyboard, touch, mouse
  and an assistive-technology click, the countdown dialog's focus, and its live-region
  announcements.

## Baseline (before fixes)

92 page views. Serious: color-contrast (229 nodes), svg-img-alt (108), aria-prohibited-attr (80),
label-content-name-mismatch (34), link-in-text-block (4), target-size (4). Moderate: region (104),
landmark-one-main (8), page-has-heading-one (4). No critical issues.

## Issues

| Page | WCAG | Severity | Status | Fix / reason |
| --- | --- | --- | --- | --- |
| Status chips everywhere (admin queues, dashboard, responders, report errors) | 1.4.3 | Serious | Fixed | Status colours (sos, ok, warn, high, violet, neon, muted) darkened in light and lightened in dark so text clears 4.5:1 on the 15% tint. Hues kept. |
| Admin charts | 1.1.1 | Serious | Fixed | Chart drawings hidden from screen readers. Bar and line charts carry a hidden data table. The donut legends already list every value. |
| Admin top-bar counters | 4.1.2 | Serious | Fixed | `aria-label` removed from the plain span. The full label is readable as screen-reader-only text on phones. |
| Admin/responder wordmark, NeuSelect filters (phone) | 2.5.3 | Serious | Fixed | Each name now includes its visible text. Selects are labelled by "label + current value". |
| Admin responders inline link | 1.4.1 | Serious | Fixed | Underlined. |
| Admin SOS map markers | 2.5.8 | Serious | Fixed (size) | 24px hit area. Pins at the same spot can still overlap. The SOS list on the same page is the equivalent control. |
| Login / signup | Best practice | Moderate | Fixed | `<main>` and `<header>` landmarks added. |
| Track page | Best practice | Moderate | Fixed | The tracking code is now the `h1`. |
| SOS button | 2.1.1, 2.5.1, 4.1.3 | Serious (manual) | Fixed | A second press within 5 seconds also arms it, so it works without a long press: keyboard, switch, screen-reader double-tap and tremor all work. Hold still works. State is announced in a live region. The hint toast mentions "tap it again". |
| SOS countdown dialog | 2.1.2, 2.4.3 | Moderate (manual) | Fixed | Tab stays on Cancel, Escape cancels, and focus returns to the SOS button. |
| Status stepper | 1.3.1, 1.4.1 | Moderate (manual) | Fixed | `aria-current="step"`, plus "done / current / not yet" in words. |
| Focus ring | 2.4.7, 1.4.11 | Moderate (manual) | Fixed | Ring now on every focusable element. Text-field focus border is full Signal Blue. |
| Auth desktop hero | 1.3.1 | Minor | Not fixed | Still `aria-hidden`. It is marketing text that repeats the form page. |
| Chart fills (amber/green bars) | 1.4.11 | Minor | Not fixed | Some fills are under 3:1. The values are also given as text (tables and legends). |

## Still to do

Re-run `npm run a11y` for the after results. Seed data so the report, SOS and responder detail
pages are covered. Do a manual keyboard pass of the admin console and Safe Walk. Update `DESIGN.md`
colour values to the new tokens.
