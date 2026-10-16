---
name: CampusSafe
description: Soft UI safety console for one campus; one pressed-and-raised material, blue for action, red for SOS, violet for anonymity.
colors:
  bg: "#e4ecf7"
  chrome: "#e9f0fa"
  panel-2: "rgb(150 172 206 / 0.16)"
  panel-3: "rgb(150 172 206 / 0.26)"
  line: "rgb(132 156 194 / 0.24)"
  line-strong: "rgb(116 140 180 / 0.42)"
  neu-dark: "rgb(146 168 202 / 0.55)"
  neu-light: "rgb(255 255 255 / 0.92)"
  neu-track: "rgb(146 168 202 / 0.32)"
  fg: "#1f2c44"
  muted: "#4f5f79"
  dim: "#586885"
  accent: "#2d6ade"
  neon: "#1f5bc7"
  neon-dim: "rgb(45 106 222 / 0.14)"
  on-accent: "#ffffff"
  ink: "#062a33"
  sos: "#c42239"
  sos-fill: "#ec3b52"
  sos-fill-hi: "#ff7f8c"
  violet: "#5b46c9"
  ok: "#00775f"
  warn: "#965800"
  high: "#b43b0a"
  p1: "#c42239"
  p2: "#b43b0a"
  p3: "#965800"
  p4: "#00775f"
typography:
  display:
    fontFamily: "Manrope, Inter, ui-sans-serif, sans-serif"
    fontSize: "6rem"
    fontWeight: 700
    lineHeight: 1
  headline:
    fontFamily: "Manrope, Inter, ui-sans-serif, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Manrope, Inter, ui-sans-serif, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
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
  caps:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 700
    lineHeight: 1.45
    letterSpacing: "0.22em"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SF Mono, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.45
rounded:
  xs: "4px"
  sm: "8px"
  seg-option: "11px"
  md: "12px"
  field: "14px"
  lg: "16px"
  topbar: "22px"
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
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.lg}"
    padding: "10px 20px"
    height: "44px"
  button-ghost:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
    rounded: "{rounded.lg}"
    padding: "10px 18px"
    height: "44px"
  button-ghost-hover:
    textColor: "{colors.neon}"
  button-auth:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.lg}"
    padding: "12px 18px"
    height: "48px"
  button-sos:
    backgroundColor: "{colors.sos-fill}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.full}"
    size: "176px"
  button-sos-md:
    backgroundColor: "{colors.sos-fill}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.full}"
    size: "72px"
  button-sos-sm:
    backgroundColor: "{colors.sos-fill}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.full}"
    size: "44px"
  input:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
    rounded: "{rounded.field}"
    padding: "10px 15px"
    height: "44px"
  card:
    backgroundColor: "{colors.bg}"
    rounded: "{rounded.xl}"
    padding: "16px"
  nav-bar:
    backgroundColor: "{colors.bg}"
    rounded: "{rounded.bar}"
  nav-item-active:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
    rounded: "{rounded.lg}"
    height: "44px"
  segmented:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.muted}"
    rounded: "{rounded.lg}"
    padding: "5px"
  segmented-active:
    textColor: "{colors.neon}"
    rounded: "{rounded.seg-option}"
    padding: "6px 14px"
  choice-tile:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
    rounded: "{rounded.md}"
    padding: "12px"
  choice-tile-chosen:
    textColor: "{colors.neon}"
  chip-p1:
    backgroundColor: "rgb(196 34 57 / 0.15)"
    textColor: "{colors.p1}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  chip-anonymous:
    backgroundColor: "rgb(91 70 201 / 0.15)"
    textColor: "{colors.violet}"
    rounded: "{rounded.full}"
    padding: "2px 0"
    width: "44px"
---

# Design System: CampusSafe

## Overview

**Creative North Star: "The Pressed Console"**

CampusSafe is a safety loop for one campus, used by a scared student on a phone, a command operator at a desk and a responder in the field. The visual world is soft UI cut from a single material: the page is a quiet soft-blue surface, and every panel, bar and control is that same surface pushed up or pressed in. Nothing floats on top of anything else. Shape comes only from a pair of shadows, a cool one to the bottom-right and a light one to the top-left, as if lit from the top-left corner. The world deliberately refuses the earlier frosted-glass look: no translucency, no backdrop blur, no aurora of colour behind the panels.

The material carries meaning. Raised means available: a card you can open, a button you can press, a tile you can pick. Pressed means chosen or typed into: the selected filter, the active nav item, the chosen category, every text field. Colour then does semantic work on top of that grammar: the one blue is "act", red is SOS and P1, violet is anonymity, and green, amber and orange carry status and severity. The calm, low-contrast surface is what lets the red SOS sphere read as the single loud thing on screen.

Density varies by role: the student app is roomy and phone-first with the SOS dish riding up out of the tab bar; the admin console is a dense grid of raised cards inside a raised sidebar and top bar; the responder app sits between. Light is the default theme and dark is a full peer (`data-theme="dark"`): the same shapes cut from a deep slate-blue (`#252c38`), lit by a faint blue-grey highlight instead of white.

**Key Characteristics:**

- One material: every surface is the page colour, shaped only by a top-left light and bottom-right shadow.
- Raised = available, pressed = chosen or typed into.
- One blue convex fill with white text for the primary action; red SOS sphere in a raised dish; violet for anonymity.
- Manrope headings, Inter body, JetBrains Mono only for machine data.
- Severity and kind carried by tinted pill chips with text labels, never colour alone.
- One authored motion moment per surface; everything else is a short exponential ease-out.

## Colors

A single cool soft-blue surface with one blue action colour and a tightly bound set of semantic signal colours; text colours are tuned for WCAG AA on the surface itself.

### Primary

- **Command Blue** (accent): the fill of the primary action, rendered as a convex gradient (`#3a77ea → #2a62d4`, dark `#3d78e8 → #2d65d4`) with white text (on-accent). Also the default non-SOS map pin. Dark value `#3570e0`.
- **Signal Blue** (neon): the readable blue for text, icons, links, the focus ring, caret, chosen segment and chosen tile labels. Dark value `#8db2ff`. Its 14% tint (neon-dim) is the selection colour and the focus halo on fields.

### Secondary

- **Alarm Red** (sos, sos-fill, sos-fill-hi): SOS and P1 only. `sos` is the readable red for text and chips (dark `#ff6b78`); `sos-fill` and `sos-fill-hi` (dark `#f2475a`, `#ff8994`) form the radial gradient of the SOS sphere and the live-alert map marker.

### Tertiary

- **Anonymous Violet** (violet): anonymous reports, the ANON kind chip, "under review" and "received" status, and the whole accent while the anonymous flow is active. Dark value `#ab9dff`.

### Status and severity

- **Resolved Green** (ok / p4), **Caution Amber** (warn / p3), **Escalation Orange** (high / p2), **Alarm Red** (p1). Severity P1 to P4 maps one-to-one to red, orange, amber, green. Each is used as text on a 15% tint of itself. Dark values: ok `#5fd3a5`, warn `#f0b75e`, high `#f68d5a`.
- **Deep Ink** (ink): text on solid ok and warn fills (dark `#10202a`).

### Neutral

- **Soft Blue Surface** (bg): the page and every panel, bar and control cut from it. The page carries a barely-there wash of the same colour (`#eaf1fa → #e4ecf7 → #dce6f3`). Dark `#252c38`.
- **Chrome** (chrome): the slightly lighter opaque surface for things that float above the page: popovers, sheets, toasts, tooltips. Dark `#2b3341`.
- **Shadow** (neu-dark) and **Highlight** (neu-light): the two lights every elevation is built from. Dark: `rgb(6 9 15 / 0.72)` and `rgb(66 79 102 / 0.55)`.
- **Track** (neu-track): the groove under progress rings, the SOS hold ring and toggles.
- **Panel 2 / Panel 3** (panel-2, panel-3): faint cool tints for hover on flat rows and nav items.
- **Hairline** (line) and **Strong Hairline** (line-strong): dividers inside cards and the activity timeline connector.
- **Slate Ink** (fg): headings and body text (dark `#e5ebf4`). **Slate** (muted): secondary text and field labels (dark `#aab5c7`). **Dim Slate** (dim): timestamps, placeholders, tertiary text (dark `#95a1b5`).

### Charts

Recharts reads its own palette that mirrors the tokens: the accent blue for volume (with the **today** bar a solid, full-strength accent and earlier days a faded fill), severity colours for P1 to P4, status colours for the status breakdown, and violet only for the anonymous share.

### Named Rules

**The Dim Floor Rule.** `dim` is the lightest text colour in the system and it passes WCAG AA for small text on the surface (4.7:1 on `#e4ecf7` in light, 5.4:1 on `#252c38` in dark). Do not introduce a lighter grey for text.

**The White-On-Blue Rule.** Text on the blue accent fill is `on-accent` white in both themes, never ink.

**The Anonymous Flip Rule.** Anonymity is shown by swapping the accent, not by adding a new one: `html.anon` rebinds neon, accent, accent-fill, accent-lift, neon-dim, neon-glow and map-pin to violet, and every component follows.

**The Violet Is Anonymity Rule.** Violet means "identity withheld". Charts, gradients and decoration do not borrow it; outside the anonymous flow it appears only on anonymous data and the under-review status.

## Typography

**Display Font:** Manrope (with Inter, ui-sans-serif)
**Body Font:** Inter (with ui-sans-serif, system-ui)
**Label/Mono Font:** JetBrains Mono (with ui-monospace, SF Mono)

**Character:** Manrope gives headings and big numerals a rounded, friendly geometry that matches the soft material; Inter keeps everything else neutral and legible under stress. Mono marks machine data only.

All `h1`, `h2` and `h3` elements are set in the display font by the base layer with `text-wrap: balance`; paragraphs use `text-wrap: pretty`.

### Hierarchy

- **Display** (700, 6rem, line-height 1): the SOS countdown numeral only. The SOS sphere label uses the same face at 700, 1.75rem, tracked 0.08em (1.125rem in the tab-bar dish, 0.8125rem on the rail).
- **Headline** (600, 1.5rem rising to 1.875rem at md, tight tracking): one page heading per screen ("Command dashboard", "Stay safe on campus"). The auth brand panel uses a 3rem bold variant.
- **Title** (600, 1rem): card and feature titles; panel headers on the admin console use the label size.
- **Body** (400, 0.875rem): list rows, descriptions, form copy. Inputs are 1rem below 768px (stops iOS zoom) and 0.875rem above.
- **Label** (600, 0.75rem): field labels in `muted`, chip text, segmented-control text, buttons at 0.8125rem.
- **Caps** (700, 0.6875rem, tracked 0.22em, uppercase, `muted`): the product line under the wordmark ("Operations console") and small in-panel section labels ("Progress", "Timeline"). It names the block it sits in; it never introduces a page heading.
- **Mono** (500, 0.6875rem): tracking codes, relative times ("30m", "14h 20m"), counts, phone numbers, the Ctrl K hint.

### Named Rules

**The No Kicker Rule.** Page headings stand alone. Do not put an eyebrow or kicker label above an `h1` or `h2`; context goes in a line below the heading (for example "Live · updated 3s ago").

**The Mono Means Machine Rule.** JetBrains Mono is for values a system produced (codes, times, counts, IDs), never for prose or headings.

## Layout

Phone-first for students and responders, desktop-first for admins, all on Tailwind's 4px spacing scale. Raised panels sit in a 12px inset from the viewport so their shadows have room to fall.

- **Student:** content column of `max-w-2xl` (narrow) or `max-w-6xl` (wide), padded 16px, 24px from sm, 32px from xl. On phones a raised tab bar (`max-w-lg`, five columns, 28px corners, 12px from the edges) sits at the bottom; the centre slot holds the SOS in an 84px dish that rides up out of the bar. On desktop a raised icon rail (76px wide, 240px at 2xl, 28px corners) replaces it and carries the smallest SOS in a pressed dish. A raised top bar (22px corners) appears on phones only.
- **Admin:** a raised sidebar (256px, 28px corners, an off-canvas drawer below lg) and a raised top bar (22px corners) frame a grid of raised cards: a row of four KPI tiles, then paired panels (live queue and case detail, activity and charts).
- **Auth:** on phones the brand header sits directly on the surface (a raised brand tile, wordmark, one-line promise) with the raised form sheet below (28px corners); from lg a two-column `max-w-5xl` layout with the brand panel beside a `max-w-md` sheet (32px corners). The `--auth-hero` gradient tokens remain defined in the stylesheet but no longer paint the phone header.
- Fixed bars respect `env(safe-area-inset-*)`. Navigation chrome carries its own view-transition name so it stays still while pages cross-fade with a small rise.
- Below 768px the large raised shadow tightens (10px to 7px offset, 24px to 16px blur) so panels do not bleed into the gutters.

## Elevation & Depth

Depth is the whole material. There is no translucency, no blur, and no border-defined panel: every surface shares the page colour and is shaped only by a dual shadow, a cool `neu-dark` to the bottom-right and a `neu-light` highlight to the top-left. Raised shadows push a surface up; inset shadows press it into the page. Controls that can be pressed use a slightly convex fill so they read as domed. The legacy custom-property names `--glass`, `--glass-strong`, `--glass-soft` and `--card-shadow` survive only as aliases to this soft UI material (surface, chrome, surface, small raised shadow) for components that still reference them; they describe nothing glassy.

### Shadow Vocabulary

Every elevation follows one recipe: a wide, soft highlight up-left does most of the shaping, a faint and tighter shadow down-right, and a small contact shadow underneath, so a raised edge reads as a gentle swell, never a dark rim. Light theme: highlight `rgb(255 255 255 / 0.95)`, shadow `rgb(13 39 80 / 0.10)`, contact `rgb(13 39 80 / 0.05)`. Dark theme: the highlight drops to a whisper (`rgb(255 255 255 / 0.035)`) so no grey halo forms, and depth comes from the shadow side (`rgb(0 0 0 / 0.42)`, contact `0.22`).

- **Raised** (`-12px -12px 30px` highlight, `10px 10px 26px` shadow, `2px 3px 8px` contact; `-8/7px` on phones): cards, panels, navigation bars, the auth sheet, the big SOS dish.
- **Raised small** (`-7px -7px 18px`, `6px 6px 16px`, `1px 2px 5px`): small tiles, the map zoom control, hover state of raised-xs controls.
- **Raised xs** (`-4px -4px 10px`, `3px 3px 8px`, `1px 1px 3px`): ghost buttons, the segmented track, unchosen choice tiles, tooltips.
- **Inset** (`inset -6px -6px 14px` highlight at 0.7, `inset 6px 6px 14px` shadow at 0.13): deep wells.
- **Inset small** (`inset -3px -3px 8px`, `inset 3px 3px 8px`): every pressed state (chosen segment, chosen tile, active nav item, selected queue row, `:active` buttons), text fields, read-only value wells, and the rail SOS dish.
- **Scroll areas never clip shadows.** A scrolling column of raised cards gets padding wide enough for the shadow (pulled back with negative margins so it still aligns); a clipped shadow shows as a hard rectangle.
- **Accent lift** (`inset 1px 1px 0 rgb(255 255 255 / 0.22), 6px 6px 14px rgb(45 106 222 / 0.32), -5px -5px 12px var(--neu-light)`): the primary and auth buttons only. In dark the coloured shadow becomes a deep neutral (`rgb(8 11 18 / 0.6)`).
- **SOS sphere** (`inset 2px 3px 6px rgb(255 255 255 / 0.28), inset -4px -6px 12px rgb(120 0 20 / 0.22), 6px 8px 18px var(--sos-glow)`, idle pulse to 34px plus a 7px faint red halo): the SOS button and nothing else. The rail size keeps a still, tight 2px 3px 6px lift.

### Named Rules

**The One Material Rule.** Every panel, bar and control is cut from the page surface and shaped only by the light/shadow pair. Do not combine a border or ring with a soft shadow on the same element, and give each control exactly one elevation cue: raised, pressed, or (for the primary) the blue lift.

**The Pressed Means Chosen Rule.** Selection is shown by sinking, not by outlining or inverting. A control that is chosen, active or typed into takes the inset shadow; everything available stays raised. Never use the inset state for "suggested" or "hovered".

**The Glow Is Earned Rule.** Coloured light belongs only to the primary blue lift and the SOS sphere. Cards, chips, rows, chart marks and legend dots never glow.

## Shapes

Soft, rounded and growing with the object: fully round pills for chips and the SOS sphere and dish; 11px for segmented options inside a 16px track; 12px for choice tiles, wells and skeletons; 14px for text fields; 16px for buttons and nav items; 22px for top bars; 24px for cards; 28px for rails, sidebars, the tab bar and the phone auth sheet; 32px for the desktop auth sheet. Panels carry no stroke at all. Approximate positions on the map are drawn as dashed hollow rings so they never read as a precise GPS fix.

## Components

### Buttons

Domed, tactile, few.

- **Shape:** gently rounded (16px), minimum 44px tall, 0.8125rem text.
- **Primary (`.btn-neon`):** the convex Command Blue fill, white bold text with slight tracking, the accent lift. Hover brightens (filter 1.06). On `:active` it sinks: scale 0.98 and an inner shadow replaces the lift. Disabled drops to 55% opacity with a wait cursor.
- **Ghost (`.btn-ghost`):** a raised-xs pad of the surface with Slate Ink semibold text. Hover rises to raised-small and turns the label Signal Blue; `:active` presses to inset small.
- **Auth (`.btn-auth`):** the primary recipe at 48px tall and 0.9375rem.
- **Focus:** the global keyboard ring (2px Signal Blue outline, 2px offset); mouse clicks stay ring-free.

### SOS (signature)

A red sphere (radial gradient from sos-fill-hi at 34% 28% to sos-fill) sitting in a raised dish of the surface. Holding fills a conic progress ring in the dish's pressed groove from the Track colour to sos-fill. Three sizes: hero (176px sphere in a 200px dish, 8px groove, idle glow pulse), phone tab bar (72px in an 84px raised dish, 5px groove), desktop rail (44px in a 56px **pressed** dish, 4px groove, no pulse, still tight lift). Presses to scale 0.96. Besides small live-status dots, live map markers and skeleton shimmer, it is the only element allowed to animate continuously.

### Chips

- **Style:** fully rounded pills, 0.75rem semibold text in the signal colour on a 15% tint of the same colour; no border, no shadow.
- **Severity (P1 to P4):** red, orange, amber, green.
- **Status:** reported/sent blue, under review/received violet, in progress/assigned amber, resolved/arrived green, closed/cancelled grey (20% muted).
- **Kind:** fixed 44px width, 10px bold tracked text: SOS red, INC blue, ANON violet.

### Cards / Containers

- **Corner Style:** 24px.
- **Background:** the surface itself.
- **Shadow Strategy:** Raised (see Elevation & Depth). Clickable cards (`.glass-hover`) rise 2px on hover-capable pointers and press to inset small on `:active`.
- **Border:** none.
- **Internal Padding:** 16px; admin panel headers sit on a hairline divider.
- **Wells:** read-only values, message bodies and secondary lists inside a card sit in inset-small wells (12 to 16px corners).

### Inputs / Fields

- **Style:** pressed into the surface (inset small), 14px corners, 44px tall, a transparent 1px border reserved for focus; placeholder in Dim Slate; Signal Blue caret.
- **Focus:** the border takes 55% Signal Blue and a 3px neon-dim halo joins the inset.
- **Labels:** 0.75rem semibold Slate, 7px above the field.

### Dropdowns (`NeuSelect`)

Every choice list uses `src/components/shared/neu-select.tsx` (Radix Select), never the platform `<select>` sheet. The trigger is the pressed field above with a chevron that turns when open. The list is a raised floating panel on `chrome` (16px corners, 8px below the trigger, at least the trigger's width); rows are 44px tall, rise to raised-xs with Signal Blue text when highlighted, and the chosen row sinks to inset small with a check. Long lists can carry group headings in the caps label style; campus places are grouped by zone (`placeOptions`). `size="sm"` gives a 40px trigger for table rows.

### SOS Conversation (`ChatThread`)

The live SOS screens for student, command and responder share `src/components/shared/chat-thread.tsx`, a raised card. The viewer's own messages sit right on the convex blue fill with white text (18px corners, a tight bottom corner on the sender's side); the other side sits left on raised-xs with a small name label; system events are centred notes in a pressed well. Times read "6:31 PM" for today. Quick-reply pills (ghost buttons) send in one tap, Enter sends and Shift+Enter breaks the line, and a "new messages" pill appears when the reader has scrolled up. Students can write while the alert is open and for 24 hours after it closes. A student's unanswered message shows as a pressed note on the command SOS list, and a new reply from command vibrates the student's phone and shows a toast.

### Safe Walk guide and progress

Picking a Safe Walk destination (a `NeuSelect` of campus places) marks it on the home map with a blue teardrop pin and an always-on label, draws a dotted guide line from the student's live position, frames both, and shows a bottom bar with distance, walking time, heading and a Directions button that hands off to Google Maps walking directions. The line is straight, not road-following. An active walk shows a "progress at a glance" ticket: a deep-navy card (the one deliberate exception to One Material, for at-a-glance contrast) with From → To, start and check-in times, a curved path whose fill and glowing walker icon track progress (by distance with GPS, by time without), the check-in countdown and an arrival estimate; details and actions sit below it on the surface.

### Segmented Control

A raised-xs track (16px corners, 5px padding, 4px gap). Options are 0.75rem semibold Slate text in 11px-rounded buttons. The chosen option (`aria-pressed="true"`) sinks: concave fill, inset small, Signal Blue text. Used for every filter and range switch (queue filter, chart range, report type, walk duration).

### Choice Tiles

Category, severity and responder pickers are raised-xs tiles (12px corners) that rise to raised-small on hover and sink to inset small with a Signal Blue (violet in the anonymous flow) label when chosen.

### Navigation

- **Student phone:** raised tab bar, five slots, SOS dish in the centre. **Student desktop:** raised icon rail. **Admin:** raised sidebar.
- **Active item:** pressed (inset small) with Slate Ink text and a Signal Blue icon; on the tab bar the icon pill sinks and the label turns Signal Blue. Inactive items are Slate with a Dim Slate icon and a faint Panel 2 hover.
- **Top bars:** raised bars with 22px corners.

### Map Markers

- **Live alert:** red dot with a surface ring and an expanding ping (blue or violet variants for other kinds).
- **You are here:** map-pin dot, 3px white ring, breathing halo.
- **Resolved:** solid green dot, no animation.
- **Approximate:** dashed hollow ring in the signal colour, no animation.
  Tiles are OpenStreetMap, desaturated toward the surface in light and night-inverted in dark. The zoom control is a raised-small stack with 14px corners.

**The Pin Rule.** On any map, only SOS is red. Non-SOS pins use `--map-pin` (the accent in light, `#8db2ff` in dark, violet in the anonymous flow), which must never drift toward red or orange.

### Activity Timeline (signature)

The admin dashboard's live feed, grouped by day. Each row has a 28px round marker tinted by kind (SOS red, anonymous violet, incident and broadcast blue, resolved green) and a 2px connector. On load, markers pop in and the connector draws downward row by row with a staggered delay; this is the dashboard's one authored motion moment. New rows slide in at the top out of a 6px blur with a brief neon-dim flash and are announced to screen readers. The scroller feathers its bottom edge while more rows wait below.

### Skeletons

Loading placeholders are a faint pressed fill (12px corners) with a soft light sweep; the sweep is removed under reduced motion.

## Do's and Don'ts

### Do:

- **Do** build every panel from the one material: surface fill, 24px corners, the Raised shadow; every navigation bar the same, at 22px or 28px.
- **Do** show "chosen", "active" and "typed into" by pressing the control in (inset small), and keep everything available raised.
- **Do** keep the primary action the only blue convex fill on a surface, with white text and the accent lift.
- **Do** carry severity and kind with tinted pill chips, always with a text label (P1, SOS, ANON, Resolved), never colour alone.
- **Do** rely on the global keyboard focus ring (2px Signal Blue outline, 2px offset), the neon-dim selection tint and the Signal Blue caret.
- **Do** give each surface at most one authored motion moment (the activity feed's draw-down on the dashboard), using exponential ease-out (`cubic-bezier(0.22, 1, 0.36, 1)` or `cubic-bezier(0.23, 1, 0.32, 1)`), with a reduced-motion fallback that shows the final state.
- **Do** keep Dim Slate as the lightest text colour, and check any text on a solid status fill clears 4.5:1 in both themes.
- **Do** redefine any new token for dark under `:root[data-theme="dark"]` and, if it is accent-coloured, for `html.anon`.

### Don't:

- **Don't** reintroduce translucent glass, backdrop blur or a coloured aurora behind panels.
- **Don't** put a border or ring and a soft shadow on the same element, or stack two elevation cues on one control.
- **Don't** mark a selection by outlining, inverting to a dark fill, or tinting; sink it.
- **Don't** let anything glow except the primary blue lift and the SOS sphere.
- **Don't** put eyebrow or kicker labels above page headings.
- **Don't** use violet for decoration, chart gradients or categorical series; it means anonymity.
- **Don't** use coloured side stripes (left-border accents) on list rows or cards to show severity or status; use chips.
- **Don't** animate continuously anything that is not live state.
- **Don't** use a grey lighter than Dim Slate for any text, including placeholders.
