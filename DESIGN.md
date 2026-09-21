---
name: Acquaintance Party
description: Sunset Soiree — a festival-poster ticketing system for one BSIT Department event; loud on the landing, quiet in the tools.
colors:
  burnt-clay: "#C2481F"
  sun-gold: "#E39824"
  cactus-sage: "#7E8B5F"
  raspberry-pink: "#D6336C"
  dusk-plum: "#3B2136"
  sand: "#F2E3CB"
  ink: "#2E1D16"
typography:
  display:
    fontFamily: "Anton, Archivo Black, sans-serif"
    fontSize: "clamp(2.25rem, 6vw, 6rem)"
    fontWeight: 400
    lineHeight: 0.95
  body:
    fontFamily: "DM Sans, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "DM Sans, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    letterSpacing: "0.05em"
rounded:
  sm: "4px"
  lg: "8px"
  pill: "9999px"
components:
  button-primary:
    backgroundColor: "{colors.burnt-clay}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: "14px 24px"
  input:
    backgroundColor: "#FFFFFF"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
---

# Design System: Acquaintance Party

## Overview

**Creative North Star: "The Festival Poster"**

Loud where students decide, quiet where volunteers work. The landing is a poster: Anton in caps, a pink-to-gold title over a dusk-plum photo, sand and clay everywhere else. Checkout and the ticket borrow the same palette and type but stay calm, because the job there is trust and legibility, not persuasion. Admin uses the same tokens on a solid dusk-plum ground; only the live door-scan results drop the theme for green, red and amber.

There is no logo, mascot or photography beyond one hero image. The identity is typographic and color-driven, and stays that way.

**Key Characteristics:**
- One token set for every surface; a hex in a component is a bug.
- Anton for headlines only, DM Sans for everything a person has to read.
- Semantic color (green / amber / red) carries status, never the theme accent.
- The ticket QR is pure black on pure white, always.

## Colors

A warm desert-dusk palette: burnt clay and gold on sand, plum for inverted grounds.

### Primary
- **Burnt Clay** (#C2481F): primary actions and headlines. White text on it measures 4.95:1; sand text on it fails at 3.9:1.

### Secondary
- **Sun Gold** (#E39824): highlights and the poster title. Takes dusk-plum text, never white.
- **Raspberry Pink** (#D6336C): attention only, such as redraw, selection and alerts.

### Tertiary
- **Cactus Sage** (#7E8B5F): tertiary fills.

### Neutral
- **Sand** (#F2E3CB): page background.
- **Dusk Plum** (#3B2136): hero ground, admin shell, inverted sections.
- **Ink** (#2E1D16): body text. Secondary text is Ink at 70%.

### Named Rules
**The Headline-Only Rule.** Burnt Clay on sand passes for large display type only. Body copy is Ink.
**The Status-Is-Not-Theme Rule.** Approved, pending and rejected are green, amber and red. The theme accent never means status.

## Typography

**Display Font:** Anton (with Archivo Black)
**Body Font:** DM Sans (with Segoe UI)

**Character:** Anton is a poster face, condensed and shouted in caps. DM Sans keeps forms and instructions plain.

### Hierarchy
- **Display** (400, clamp 2.25–6rem, 0.95): landing title and page headings, always uppercase.
- **Body** (400, 1rem, 1.5): instructions and form copy, capped at prose width.
- **Label** (600, 0.875rem, +0.05em, uppercase when a control): field labels, buttons, small caps captions.

### Named Rules
**The Display-Is-Rare Rule.** Anton never sets a paragraph. Two lines is a lot.

## Layout

Mobile-first, because phones are the only real usage. Public pages sit in a `max-w-5xl` container (`2xl:max-w-7xl`) with 20px side gutters; checkout is two columns from `md`, one column below. Forms stack with 20px gaps: label, hint, input, error. The ticket is a single centered `max-w-md` column.

## Elevation & Depth

Flat by default. Depth comes from tonal layering (white or translucent-white panels on sand, black/20 panels on plum) and one small shadow on the ticket card. No glows.

## Shapes

Small, quiet corners (4px) on inputs, buttons and panels; 8px on the ticket card; full pills for compact actions such as the email-fix chip and the scanner Start button. Ticket status uses tinted panels, never a thick colored side border.

## Components

### Buttons
- **Shape:** 4px corners; pill for compact inline actions.
- **Primary:** Burnt Clay fill, white text, uppercase, +0.05em tracking, 14px 24px.
- **Hover / Focus:** hover drops opacity to 90%; focus is a 2px outline offset 2px in Burnt Clay (Sun Gold on plum grounds).
- **Disabled:** 60% opacity, label switches to a progress verb.

### Inputs / Fields
- **Style:** white fill, 1px Ink/25 border, 4px radius, 10px 12px padding, Ink/40 placeholders.
- **Focus:** border and 2px outline turn Burnt Clay.
- **Error:** Burnt Clay 14px medium text under the field; typed values are always kept.

### Ticket card
White card, Burnt Clay header with the event name in Anton. The QR block inside is plain white with a 4-module quiet zone, never themed. Status blocks (amber pending, red rejected) are tinted panels with a display-face heading.

### Door scanner results
Full-screen green, red or amber with white text, no theme accent. Every state names the next action.

## Do's and Don'ts

### Do:
- **Do** read colors and fonts from tokens (`src/lib/config/theme.ts` and the `@theme` block in `globals.css`).
- **Do** verify contrast when adding a button: `bg-accent` takes `text-white`, `bg-accent-2` takes `text-deep`.
- **Do** keep 44px tap targets on phone controls, especially at the door.

### Don't:
- **Don't** put the theme accent on status or on live scan results.
- **Don't** tint, texture or restyle the ticket QR.
- **Don't** invent photography, testimonials or attendance numbers; none exist.
- **Don't** add a colored `border-left` or `border-right` over 1px to cards or alerts. (The scanner's white viewfinder corners are brackets, not cards.)
