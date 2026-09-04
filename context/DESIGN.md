# DESIGN.md — Design System

## 0. Theme: Sunset Soiree (confirmed 2026-09-02, extended to admin 2026-09-03)
Coachella-inspired — burnt clay, sun gold, sand. Built under the internal
codename "Desert Sundown"; the committee's confirmed name is "Sunset Soiree,"
and the palette needed no changes to fit it. Every color and font is still a
token in exactly two places — `src/lib/config/theme.ts` and the `@theme`
block in `src/app/globals.css` — and nowhere else, so any *future* theme
change stays a token edit, not a rebuild. If you find a hex value or a font
name hardcoded in a component, that's a bug — replace it with the Tailwind
utility that reads the token.

As of 2026-09-03, admin is themed too — see §3. There is no longer a
separate "neutral admin" palette or a raffle-only "Night Set"; one token set
covers every surface, public and admin alike.

Full rationale and the three directions considered:
`docs/superpowers/specs/2026-08-30-acquaintance-party-ticketing-design.md`
§Visual design.

## 1. Color tokens
| Token | Hex | Role |
|---|---|---|
| `--color-accent` | `#C2481F` | Primary actions, headlines (burnt clay) |
| `--color-accent-2` | `#E39824` | Highlights, poster title (sun gold) |
| `--color-accent-3` | `#7E8B5F` | Tertiary fills (cactus sage) |
| `--color-accent-4` | `#D6336C` | Attention — redraw, selection, alerts (raspberry pink), added 2026-09-03 |
| `--color-deep` | `#3B2136` | Hero ground, inverted sections (dusk plum) |
| `--color-ground` | `#F2E3CB` | Page background (sand) |
| `--color-ink` | `#2E1D16` | Body text |

**No second token group anymore.** The raffle projector had its own "Night
Set" (a dark indigo/magenta palette, `--color-night-*`) built specifically
because a projector in a dim room can't use the sand-toned public palette.
Retired 2026-09-03 as a deliberate call, not a bug fix — the user chose one
consistent Sunset Soiree language across admin and the raffle over keeping
that separate dark variant. Two admin-specific *compositions* of the tokens
above took its place, both built from existing values, not new hex:
- **Solid `bg-deep text-ground`** for data-dense screens (Dashboard, Review
  queue) — the same dark-plum-on-sand-text pairing the public landing
  page's dark hero band already uses.
- **A gradient wash**, `bg-gradient-to-br from-deep via-deep to-accent/30`,
  for single-focus screens (Find a registration's search, the Scanner's
  setup screen) — via Tailwind's gradient utilities over the same tokens.
- **`bg-black/20`** for a panel sitting on either of the above — a
  structural darkening overlay, the same category as the `text-white`
  button-contrast fix below, not a new brand color.

## 2. Type
- Display: **Anton** (`--font-display`), self-hosted via `next/font/google`
  in `src/app/layout.tsx`. Used uppercase, for headlines and the event name.
- Body: **DM Sans** (`--font-body`), same loading mechanism.
- Both fonts are also declared as fallback strings in `theme.ts` for
  anywhere `next/font`'s CSS variable isn't in scope — keep the two in sync.

## 3. Surface priority — not every screen gets the same treatment
As of 2026-09-03, every screen is themed **except one carve-out**, kept for
a stated functional reason rather than taste:

| Surface | Treatment | Why |
|---|---|---|
| Landing, checkout | Full theme | The marketing surface — this is where the visual direction does its work |
| Ticket page | Themed header, **plain white QR card** | See §4 |
| Admin — dashboard, Payments, find a registration | Full theme, solid `bg-deep` | Themed 2026-09-03 (was neutral/slate) — data-dense but no longer treated as a reason to drop the identity. Find a registration moved here 2026-09-04, dropping its earlier gradient hero once it became a filterable table matching the other two |
| Admin — scanner setup | Full theme, gradient wash | The one remaining single-focus screen; themed 2026-09-03 |
| Raffle projector | Full theme, same tokens as the rest of admin | Previously had its own separate "Night Set" dark palette; retired 2026-09-03 in favor of one consistent language — see §1 |
| Door scanner — **live scan results only** | Semantic color only, no theme accent | The one surviving carve-out: read at arm's length, in the dark, by a volunteer under time pressure, where an ambiguous color reads as a wrong answer instantly. Only the *result* screens (green/red/amber) — the setup screen before scanning starts is themed |
| Admin login | Not yet themed | Out of scope for the 2026-09-03 pass; flagged as the next inconsistency to fix, not forgotten |

## 4. The QR rule — camera constraint, not style
The ticket QR (`src/lib/tickets/qr.ts` → `ticketQrDataUrl`) renders **pure
black on pure white with a 4-module quiet zone**, always, regardless of the
surrounding theme. Phone cameras fail to focus on codes drawn over tinted or
textured grounds, and the door is the worst possible place to discover that.
The themed ticket header stops at the edge of the white card
(`src/app/ticket/[id]/page.tsx` → `ApprovedTicket`) — never theme that block.

## 5. Admin — themed shell, semantic color for status only
**Implemented:** `src/app/admin/layout.tsx` wraps every `/admin/*` route in a
`bg-deep text-ground` shell — the same Sunset Soiree tokens as the public
site, not a neutral palette. `src/app/admin/badge.tsx`'s status pills still
use semantic green/amber/red only — status meaning is never carried by the
theme accent, even though the shell around it is now themed.

**The one carve-out:** `src/app/admin/scan/scanner.tsx`'s *live scan
result* screens (after "Start scanning" is pressed) fill the whole screen
with one of three states, semantic color only, **green / red / amber**,
completely untouched by the theming pass:
- Green — valid, let them in, name + section shown so a volunteer can
  spot-check against a student ID
- Red — duplicate or invalid, with the specific reason and a next action
  ("already scanned at 8:14 PM", "search by name instead")
- Amber — a camera or permission failure, not a scan result
- Never the theme's `--color-accent` for these states — semantic color must
  stay legible and unambiguous independent of whatever the public theme ends
  up being.

A static white corner-bracket guide frame overlays the camera view — not
tied to the detector's actual read position, since mapping the detector's
video-pixel coordinates onto the rendered `object-cover` video element is
easy to get subtly wrong. It just tells the volunteer where to aim.

## 6. Accessibility targets
- Contrast: 4.5:1 for body text, 3:1 for large display type.
- `--color-accent` on `--color-ground` passes for headlines only — body copy
  always uses `--color-ink`, never the accent color, at small sizes.
- Every interactive element needs a visible focus state (see the
  `focus:outline-accent` pattern in `checkout-form.tsx`).
- Themed admin buttons follow one rule, not the mockup's apparent color:
  `bg-accent` gets `text-white` (measured 4.95:1; `text-ground` on that same
  background measured 3.9:1 and fails), `bg-accent-2` gets `text-deep`
  (dark-on-light, correct direction for the brighter gold). Verify computed
  contrast when adding a new themed button — don't copy a hex by eye.

## 7. What's actually built vs. planned
Every surface exists and follows this system: landing (polished), checkout,
ticket page, Payments, admin search, the door scanner (setup screen themed,
live results semantic-only), the attendance dashboard, and the raffle
projector — all themed as of 2026-09-03. Admin login is the one built
surface still on its original neutral styling; a known gap, not an
oversight.

Plans 1 and 2 are verified by hand. The raffle projector is built but not yet
rehearsed on a real projector — check its legibility from the back of a room
before the night, not on a laptop at arm's length. The admin theming pass
(dashboard, Payments, find-a-registration, scanner setup, raffle) has
passed `npm test`/`build`/`lint` but has not yet been clicked through by a
human — it needs the same hand-verification every other surface got.
