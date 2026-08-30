# DESIGN.md — Design System

## 0. Theme status: not finalized
The working theme is Coachella-inspired ("Desert Sundown" — burnt clay, sun
gold, sand). **The committee has not confirmed this.** That's why every color
and font is a token in exactly two places — `src/lib/config/theme.ts` and the
`@theme` block in `src/app/globals.css` — and nowhere else. Swapping the
theme should never touch a component file. If you find a hex value or a font
name hardcoded in a component, that's a bug — replace it with the Tailwind
utility that reads the token.

Full rationale and the three directions considered:
`docs/superpowers/specs/2026-08-30-acquaintance-party-ticketing-design.md`
§Visual design.

## 1. Color tokens
| Token | Hex | Role |
|---|---|---|
| `--color-accent` | `#C2481F` | Primary actions, headlines (burnt clay) |
| `--color-accent-2` | `#E39824` | Highlights, poster title (sun gold) |
| `--color-accent-3` | `#7E8B5F` | Tertiary fills (cactus sage) |
| `--color-deep` | `#3B2136` | Hero ground, inverted sections (dusk plum) |
| `--color-ground` | `#F2E3CB` | Page background (sand) |
| `--color-ink` | `#2E1D16` | Body text |

## 2. Type
- Display: **Anton** (`--font-display`), self-hosted via `next/font/google`
  in `src/app/layout.tsx`. Used uppercase, for headlines and the event name.
- Body: **DM Sans** (`--font-body`), same loading mechanism.
- Both fonts are also declared as fallback strings in `theme.ts` for
  anywhere `next/font`'s CSS variable isn't in scope — keep the two in sync.

## 3. Surface priority — not every screen gets the theme
Five surfaces, three different jobs. This isn't a preference, it's matched to
what each screen is for:

| Surface | Treatment | Why |
|---|---|---|
| Landing, checkout | Full theme | The marketing surface — this is where the visual direction does its work |
| Ticket page | Themed header, **plain white QR card** | See §4 |
| Raffle projector (plan 3) | Full theme, own dark palette | Runs after dark in a dim room — a sand ground glares; needs a deliberate dark variant, not the public palette |
| Door scanner (plan 2) | Semantic color only, no theme accent | Read at arm's length, in the dark, by a volunteer under time pressure |
| Admin review, search, dashboard | Neutral, dense | Someone is working through hundreds of records — decoration slows that down |

## 4. The QR rule — camera constraint, not style
The ticket QR (`src/lib/tickets/qr.ts` → `ticketQrDataUrl`) renders **pure
black on pure white with a 4-module quiet zone**, always, regardless of the
surrounding theme. Phone cameras fail to focus on codes drawn over tinted or
textured grounds, and the door is the worst possible place to discover that.
The themed ticket header stops at the edge of the white card
(`src/app/ticket/[id]/page.tsx` → `ApprovedTicket`) — never theme that block.

## 5. Admin and scanner — neutral shell, semantic color, not accent
**Implemented:** `src/app/admin/layout.tsx` wraps every `/admin/*` route in a
`bg-slate-100 text-slate-900` shell — Tailwind's neutral palette, not the
theme tokens. No `font-display`, no `--color-accent` on admin surfaces. Any
new admin page inherits this from the layout automatically; don't re-theme
one on purpose.

When the scanner is built (plan 2), its three states use **green / red /
amber only**:
- Green — valid, let them in, name + section shown so a volunteer can
  spot-check against a student ID
- Red — duplicate or invalid, with the specific reason and a next action
  ("already scanned at 8:14 PM", "search by name instead")
- Never the theme's `--color-accent` for these states — semantic color must
  stay legible and unambiguous independent of whatever the public theme ends
  up being.

## 6. Accessibility targets
- Contrast: 4.5:1 for body text, 3:1 for large display type.
- `--color-accent` on `--color-ground` passes for headlines only — body copy
  always uses `--color-ink`, never the accent color, at small sizes.
- Every interactive element needs a visible focus state (see the
  `focus:outline-accent` pattern in `checkout-form.tsx`).

## 7. What's actually built vs. planned
Landing (plain, not yet polished), checkout, and admin login + review queue
exist and follow this system. The ticket page (QR generation is done; the
page that renders it is not), admin search, the scanner, and the raffle
projector are specced here but not yet built — see
`docs/superpowers/plans/2026-08-30-sell-and-verify.md` for what's done.
