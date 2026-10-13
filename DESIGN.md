---
name: CampusSafe
description: Liquid-glass safety console for one campus; cyan for action, red for SOS, violet for anonymity.
colors:
  neon: "#00849a"
  accent: "#00cfe8"
  ink: "#062a33"
  sos: "#e0354a"
  sos-fill: "#ff4357"
  violet: "#6a55d6"
  ok: "#00826c"
  warn: "#a86500"
  high: "#c2410c"
  p1: "#e0354a"
  p2: "#c2410c"
  p3: "#a86500"
  p4: "#00826c"
  bg: "#f3f5f8"
  chrome: "#ffffff"
  panel: "rgb(255 255 255 / 0.8)"
  panel-2: "rgb(255 255 255 / 0.55)"
  panel-3: "rgb(226 232 240 / 0.6)"
  glass: "rgb(255 255 255 / 0.55)"
  glass-strong: "rgb(255 255 255 / 0.72)"
  glass-soft: "rgb(255 255 255 / 0.5)"
  line: "#e2e7ef"
  line-strong: "#cbd3df"
  fg: "#1b2430"
  muted: "#5e6b7e"
  dim: "#66738a"
  auth-hero-deep: "#0a3446"
  auth-sheet: "#ffffff"
  auth-page: "#eef3f7"
  auth-field: "#f5f8fb"
  auth-field-border: "#d9e1ea"
  auth-cta: "#0e7490"
  auth-cta-hover: "#0b6279"
  auth-placeholder: "#66738a"
typography:
  display:
    fontFamily: "Space Grotesk, Inter, ui-sans-serif, sans-serif"
    fontSize: "6rem"
    fontWeight: 700
    lineHeight: 1
  headline:
    fontFamily: "Space Grotesk, Inter, ui-sans-serif, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Space Grotesk, Inter, ui-sans-serif, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.43
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.33
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SF Mono, monospace"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  xs: "4px"
  sm: "8px"
  md: "12px"
  control: "14px"
  lg: "16px"
  card: "22px"
  xl: "24px"
  bar: "28px"
  2xl: "32px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
    height: "44px"
  button-ghost:
    backgroundColor: "{colors.glass-soft}"
    textColor: "{colors.fg}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
    height: "44px"
  button-ghost-hover:
    backgroundColor: "{colors.panel-2}"
  button-auth:
    backgroundColor: "{colors.auth-cta}"
    textColor: "{colors.auth-sheet}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
    height: "48px"
  button-auth-hover:
    backgroundColor: "{colors.auth-cta-hover}"
  button-sos:
    backgroundColor: "{colors.sos-fill}"
    textColor: "{colors.chrome}"
    typography: "{typography.display}"
    rounded: "{rounded.full}"
    size: "176px"
  input:
    backgroundColor: "{colors.glass-soft}"
    textColor: "{colors.fg}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
    height: "44px"
  input-auth:
    backgroundColor: "{colors.auth-field}"
    textColor: "{colors.fg}"
    rounded: "{rounded.control}"
  card:
    backgroundColor: "{colors.glass}"
    rounded: "{rounded.card}"
    padding: "16px"
  nav-bar:
    backgroundColor: "{colors.glass-strong}"
    rounded: "{rounded.bar}"
  segmented:
    backgroundColor: "{colors.glass-soft}"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "4px"
  segmented-active:
    backgroundColor: "{colors.fg}"
    textColor: "{colors.chrome}"
  chip-p1:
    backgroundColor: "rgb(224 53 74 / 0.15)"
    textColor: "{colors.p1}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  chip-anonymous:
    backgroundColor: "rgb(106 85 214 / 0.15)"
    textColor: "{colors.violet}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 0"
    width: "44px"
---

# Design System: CampusSafe

## Overview

**Creative North Star: "The Calm Glass Console"**

CampusSafe is a safety loop for one campus, used by a scared student on a phone, a command operator at a desk and a responder in the field. The visual world is liquid glass over an aurora: a fixed, softly coloured gradient field sits behind every page, and every panel, bar and sheet is frosted glass that lets that light through. The result reads calm and technical rather than alarming, so the one thing that is allowed to be loud, the red SOS, is unmistakable.

Colour is semantic before it is decorative. Cyan (neon/accent) is "act" and "you"; red is SOS and P1; violet is anonymity, and the anonymous flow flips the whole accent to violet; green, amber and orange carry status and severity. Everything else is a cool slate neutral. Density varies by role: the student app is roomy and phone-first with a centred SOS in the tab bar; the admin console is a dense multi-panel dashboard of framed glass cards with fixed headers and scrolling bodies; the responder app sits between the two.

Light is the default theme and dark is a full peer (`data-theme="dark"`), not an afterthought: every token is redefined for dark, and the map tiles switch to a night rendering of the same provider.

**Dark is warm charcoal, not navy.** Dark mode uses neutral greys with a faint warm cast (bg `#1f1e1d`, chrome `#1a1918`, panels `#302f2c` at 80%, text `#f2efe8`, muted `#b3afa5`), a soft warm gradient behind the glass (clay, sand and a trace of violet over `#24221f → #1c1b19`), and a **clay** accent instead of cyan: `accent` `#d97757` for fills with dark-brown ink (`#2a1a12`) on them, `neon` `#e8936f` for text, icons, links and focus. SOS stays a clear red (`#f2555c`), anonymous stays violet (`#a594f9`), and status/severity colours are softened (ok `#6bc99a`, warn `#e9b45a`, high `#ee8650`). Never reintroduce blue-tinted surfaces or cyan glow in dark.

**Key Characteristics:**
- Frosted glass panels (22px corners, lit top edge, hairline, soft drop) over a fixed aurora.
- Semantic colour: cyan act, red SOS, violet anonymous, green/amber/orange status.
- Space Grotesk headings, Inter body, JetBrains Mono for codes, times and counts.
- Pill chips and tinted tiles carry severity and kind; never colour alone.
- One authored motion moment per surface; everything else is quiet, exponential ease-out.

## Colors

A cool slate neutral field with one cyan action colour and a tightly bound set of semantic signal colours; text colours are tuned for WCAG AA, bright brand fills are kept for surfaces.

### Primary
- **Signal Teal** (neon): the readable accent for text, icons, links, focus rings, caret and selection tint. In dark it becomes clay (`#e8936f` text, `#d97757` fill). Under `html.anon` it becomes violet (`#6a55d6` light, `#b3a6fb` text / `#a594f9` fill dark).
- **Bright Cyan** (accent): the fill colour for the primary button, active tab tint, "you are here" marker and progress bars. Text on it is always **Deep Ink** (ink), never white.

### Secondary
- **Alarm Red** (sos, sos-fill): SOS and P1 only. `sos` is the readable red for text and chips; `sos-fill` (`#ff4357` light, `#f2555c` dark) is the radial-gradient fill of the SOS button and the pulsing alert marker.

### Tertiary
- **Anonymous Violet** (violet): anonymous reports, "under review" and "received" status, and the whole accent when the anonymous flow is active.

### Status and severity
- **Resolved Green** (ok / p4), **Caution Amber** (warn / p3), **Escalation Orange** (high / p2), **Alarm Red** (p1). Severity P1 to P4 maps one-to-one to red, orange, amber, green. Each is used as text on a 15% tint of itself.

### Neutral
- **Mist** (bg): page background under the aurora. **Chrome** (chrome): solid white for the few opaque surfaces.
- **Glass**, **Glass Strong**, **Glass Soft** (glass, glass-strong, glass-soft): panel fill, navigation-bar fill, and the faint fill for rows, inputs and ghost buttons.
- **Panel**, **Panel 2**, **Panel 3**: older translucent fills still used for map controls, tooltips and hover states.
- **Hairline** (line) and **Strong Hairline** (line-strong): dividers, input borders, timeline connectors.
- **Slate Ink** (fg): body and heading text. **Slate** (muted): secondary text and labels. **Dim Slate** (dim): timestamps, placeholders, tertiary text.

### Auth palette
The sign-in and sign-up screens use their own `--auth-*` family scoped to `.auth-shell`: a deep teal hero gradient (from `#0a3446`; warm charcoal-to-umber with a clay glow in dark), an **opaque** form sheet (auth-sheet; `#262523` in dark), a solid teal CTA (auth-cta; clay `#d97757` with dark-brown text in dark), its own field fill and border, link colour, placeholder (auth-placeholder) and selection tint. The glass panel is deliberately not used here: a translucent sheet let the hero bleed through.

### Named Rules
**The Dim Floor Rule.** `dim` is the lightest text colour in the system and it is set to pass WCAG AA for small text on white and on glass (`#66738a` light, `#9a968c` dark). Do not introduce a lighter grey for text.

**The Ink-On-Cyan Rule.** Text on Bright Cyan, Caution Amber or Resolved Green fills is `ink` (`#062a33`) in both themes, never white.

**The Anonymous Flip Rule.** Anonymity is shown by swapping the accent, not by adding a new one: `html.anon` rebinds neon, accent, neon-dim and neon-glow to violet, and every component follows.

## Typography

**Display Font:** Space Grotesk (with Inter, ui-sans-serif)
**Body Font:** Inter (with ui-sans-serif, system-ui)
**Label/Mono Font:** JetBrains Mono (with ui-monospace, SF Mono)

**Character:** Space Grotesk gives headings and numbers a slightly engineered, instrument-panel edge; Inter keeps everything else neutral and legible under stress. Mono marks machine data: tracking codes, timestamps, counts, role tags.

All `h1`, `h2` and `h3` elements are set in the display font by the base layer, with `text-wrap: balance`; paragraphs use `text-wrap: pretty`.

### Hierarchy
- **Display** (700, 6rem, line-height 1): the SOS countdown numeral only. The SOS button label uses the same face at 700, 1.75rem, tracked 0.08em.
- **Headline** (600, 1.5rem rising to 1.875rem at md, tight tracking): one page heading per screen ("Command dashboard", "Stay safe on campus").
- **Title** (600, 0.875rem): panel and card titles inside dashboard cards; 1.125rem for dialog and sheet titles.
- **Body** (400, 0.875rem): list rows, descriptions, form copy. Inputs are 1rem below 768px (stops iOS zoom) and 0.875rem above.
- **Label** (500 to 600, 0.75rem): field labels in `muted`, chip text, segmented-control text. Small in-panel section headings ("Progress", "Timeline") use 0.6875rem, 600, uppercase, wide tracking, in `muted`.
- **Mono** (400, 0.6875rem): badges, relative times ("30m", "14h 30m"), tracking codes, table headers.

### Named Rules
**The No Kicker Rule.** Page headings stand alone. Do not put an eyebrow or kicker label above an `h1` or `h2`; context goes in a line below the heading (for example "Live · updated 3s ago").

**The Mono Means Machine Rule.** JetBrains Mono is for values a system produced (codes, times, counts, IDs), never for prose or headings.

## Layout

Phone-first for students and responders, desktop-first for admins, all on Tailwind's 4px spacing scale.

- **Student:** content column of `max-w-2xl` (narrow) or `max-w-6xl` (wide). On phones a floating glass tab bar (`max-w-lg`, five columns, 28px corners) sits at the bottom with the compact SOS (84px) in the centre slot. On desktop a floating glass icon rail (76px wide, 240px at 2xl) replaces it, carrying the smallest SOS (56px).
- **Admin:** a floating glass sidebar and a floating glass top bar frame a grid of dashboard cards: a row of four KPI tiles, then paired panels (queue and case detail, activity and charts). Each card has a fixed 56px header with a hairline below and a scrolling body padded 12px (16px from sm).
- **Responder:** a floating glass top bar over a `max-w-6xl` column, padded 16px (24px from sm).
- **Auth:** on phones a teal hero header with the sheet rising over it (28px top corners); from lg a two-column `max-w-5xl` layout with a brand panel beside a `max-w-md` sheet.
- Fixed bars respect `env(safe-area-inset-*)` via `pt-safe` / `pb-safe`. Navigation chrome carries its own view-transition name so it stays still while pages cross-fade.

## Elevation & Depth

Depth comes from glass, not from stacked shadows. Every panel is the same material: translucent fill, a backdrop blur with boosted saturation, an inset white highlight on the top edge, a one-pixel edge ring, and one soft diffuse drop. Navigation chrome uses a denser, more opaque glass with a stronger blur so it stays legible over content. The aurora behind the page is what the glass refracts; it is fixed and never scrolls. In dark the drops deepen and the highlights fade to near nothing.

### Shadow Vocabulary
- **Glass panel** (`box-shadow: var(--glass-highlight), 0 0 0 1px var(--glass-edge), var(--glass-shadow)`; blur 22px, 16px under 768px): every card and panel.
- **Glass bar** (same stack, blur 28px, saturate 1.8): sidebars, top bars, tab bar.
- **Neon glow** (`0 0 0 1px var(--color-accent), 0 4px 16px var(--neon-glow)`): primary button only; grows to 24px on hover.
- **SOS glow** (`0 0 40px var(--sos-glow)`, pulsing 28 to 56px): the SOS button and nothing else.
- **Auth CTA lift** (`0 8px 20px -8px var(--auth-cta-glow)`): the auth submit button.

### Named Rules
**The One Material Rule.** A surface is either glass (`.card`/`.glass`) or glass bar (`.glass-bar`). Do not invent a third panel recipe or a heavier shadow for emphasis; emphasis comes from colour and content.

**The Glow Is Earned Rule.** Coloured glows belong only to the primary action and the SOS. Cards, chips and rows never glow.

## Shapes

Soft and rounded throughout, with radius growing with the size of the object: pill chips and the circular SOS; 10px for segmented-control buttons; 14px for buttons, inputs and the segmented track; 22px for cards; 28px for floating navigation bars and the auth sheet; 24 to 32px for large tiles. Borders are hairlines (1px `line`), never heavy strokes. Approximate positions on the map are drawn as dashed hollow rings so they never read as a precise GPS fix.

## Components

### Buttons
Tactile, confident and few.
- **Shape:** gently rounded (14px), minimum 44px tall.
- **Primary (`.btn-neon`):** Bright Cyan fill, Deep Ink text, 13px bold with slight tracking, neon glow. Hover brightens (filter 1.08) and widens the glow. Disabled drops to 55% opacity with a wait cursor.
- **Ghost (`.btn-ghost`):** Glass Soft fill, hairline border, Slate Ink text, 13px medium. Hover moves to Panel 2 with a stronger hairline.
- **Auth (`.btn-auth`):** solid teal (auth-cta), white text (clay with dark-brown text in dark), 48px tall, 15px semibold, a soft lift shadow; presses to scale 0.99.
- **Focus:** the global ring (2px Signal Teal outline, 2px offset), keyboard only.

### SOS Button (signature)
A 176px red sphere (radial gradient from `#ff7a86` to sos-fill) inside a 200px conic progress ring that fills while the user holds to send. It pulses its glow when idle, presses to scale 0.96, and appears in three sizes: hero (176px), phone tab bar (72px in an 84px ring) and desktop rail (46px in a 56px ring). Besides small live-state dots and live map markers, it is the only element allowed to animate continuously.

### Chips
- **Style:** fully rounded pills, 12px semibold text in the signal colour on a 15% tint of the same colour; no border.
- **Severity (P1 to P4):** red, orange, amber, green.
- **Status:** reported/sent cyan, under review/received violet, in progress/assigned amber, resolved/arrived green, closed/cancelled grey.
- **Kind:** fixed 44px width, 10px bold tracked text: SOS red, INC cyan, ANON violet.

### Cards / Containers
- **Corner Style:** 22px.
- **Background:** Glass, with backdrop blur and the glass shadow stack (see Elevation & Depth).
- **Border:** 1px glass-border (bright white in light, faint white in dark) plus an inset edge ring.
- **Internal Padding:** 12px, 16px from sm; dashboard cards have a 56px header row with a hairline divider.
- **Hover:** clickable tiles (`.glass-hover`) lift 2px and move to Glass Strong on pointer devices, and press to scale 0.985.

### Inputs / Fields
- **Style:** Glass Soft fill, 1px hairline, 14px corners, 44px tall; placeholder in Dim Slate; Signal Teal caret.
- **Focus:** fill moves to Panel, border to Signal Teal, plus a 3px neon-dim halo.
- **Labels:** 12px medium Slate, 6px above the field.
- **Auth fields:** auth-field fill and auth-field-border, auth-placeholder placeholder, auth-link caret and focus ring.

### Segmented Control
A 14px rounded Glass Soft track with 4px padding; options are 12px medium Slate text in 10px-rounded buttons. The pressed option inverts to Slate Ink fill with panel-coloured text. Used for every filter and range switch (queue filter, chart range, report type).

### Navigation
- **Student phone:** floating glass tab bar, five slots, SOS in the centre. **Student desktop / admin:** floating glass rail or sidebar.
- **Active item:** a 15% Bright Cyan tint with an inset neon-dim ring and Slate Ink text; inactive items are Slate.
- **Top bars:** floating glass bars with 22 to 28px corners.

### Map Markers
- **Live alert:** red dot with a white panel ring and an expanding ping (cyan or violet variants for other kinds).
- **You are here:** cyan dot, 3px white ring, breathing halo.
- **Resolved:** solid green dot, no animation.
- **Approximate:** dashed hollow ring in the signal colour, no animation.
Map tiles are OpenStreetMap, softened in light and night-inverted with a slight warm sepia in dark. Non-SOS pins (incidents, units, "you are here") use `--map-pin`: the accent in light, sand `#e6d3ad` in dark, so no pin can ever be mistaken for SOS red.

**The Pin Rule.** On any map, only SOS is red. If an accent colour drifts toward red or orange, map pins must take a separate, clearly non-red token.

### Activity Timeline (signature)
The admin dashboard's live feed, grouped by day. Each row has a 28px round marker tinted by kind (SOS red, anonymous violet, incident and broadcast cyan, resolved green) and a 2px connector line. On load, markers pop in and the connector draws downward row by row with a staggered delay; this is the dashboard's one authored motion moment. New rows slide in at the top out of a 6px blur with a brief neon-dim flash and are announced to screen readers. The scroller feathers its bottom edge while more rows wait below. Ported from a 21st.dev Timeline to CSS keyframes and project tokens.

### Skeletons
Loading placeholders are a soft slate fill (12px corners) with a light sweep; the sweep is removed under reduced motion.

## Do's and Don'ts

### Do:
- **Do** build every panel from the one glass material (`.card`/`.glass`, 22px) and every navigation bar from `.glass-bar`.
- **Do** carry severity and kind with pill chips and tinted tiles, always with a text label (P1, SOS, ANON, Resolved), never colour alone.
- **Do** rely on the global keyboard focus ring (2px Signal Teal outline, 2px offset) and the themed selection tint and caret; on auth screens use the `--auth-*` ring, caret, placeholder and selection.
- **Do** use the `--auth-*` token set, the opaque sheet and the solid teal CTA on sign-in and sign-up screens.
- **Do** give each surface at most one authored motion moment (the activity feed's draw-down on the dashboard), using exponential ease-out (`cubic-bezier(0.22, 1, 0.36, 1)` or `cubic-bezier(0.23, 1, 0.32, 1)`), with a reduced-motion fallback that shows the final state.
- **Do** port third-party (21st.dev) components to CSS motion and project tokens before they ship.
- **Do** keep Dim Slate as the lightest text colour and Deep Ink as the text on bright fills.
- **Do** redefine any new token for dark under `:root[data-theme="dark"]`.

### Don't:
- **Don't** put eyebrow or kicker labels above page headings.
- **Don't** use coloured side stripes (left-border accents) on list rows or cards to show severity or status; use chips and tiles.
- **Don't** show availability, coverage, response-time or adoption claims the product cannot back up (no "24/7 monitoring", no user counts, no endorsement).
- **Don't** import a third-party component together with its own design system, animation library or palette.
- **Don't** animate continuously anything that is not live state; looping motion is reserved for the SOS button, live map markers and small live-status dots.
- **Don't** put white text on Bright Cyan, Caution Amber or Resolved Green fills.
- **Don't** use the translucent glass panel behind auth forms.
- **Don't** use a grey lighter than Dim Slate for any text, including placeholders.
