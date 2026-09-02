# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two roles, no others:

- **Student** — a BSIT Department college student buying a ticket on their
  phone. Mobile-first by necessity, not preference: checkout, the ticket
  page, and the landing page are filled out and revisited on a phone,
  frequently over the venue's or a mobile carrier's shaky signal.
- **Admin** — BSIT Department staff or student volunteers. Review receipts,
  scan tickets at the door, and run the raffle. A handful of people, often
  also on phones, under time pressure at the door.

No other audience. This is not open to the public or other departments.

## Product Purpose

Sells and verifies tickets to a single one-off school event (the BSIT
Department's "Acquaintance Party", ~600+ attendees), replacing what would
otherwise be a manual, error-prone process: a student pays by GCash, uploads
a receipt, and gets a QR ticket once an admin approves it by hand; admins
scan tickets at the door — offline-tolerant, since venue wifi is
unreliable — and run a raffle for everyone who actually showed up and got
scanned in. Success is a smooth check-in night with no double-admit chaos,
a raffle result nobody has reason to distrust, and students who paid real
money trusting the process enough to actually show up having bought in.

## Positioning

None. This is an internal, one-off tool for a single school department's
event, not a product competing for adoption or market share. No competitive
claim should be designed around or implied.

## Operating Context

- Runs the week of a single fixed event date (2026-10-05, SCC Annex
  Building, 4–8 PM) — not an ongoing service.
- Venue wifi is unreliable; the door scanner must work fully offline and
  sync later. This is a hard technical constraint that shaped the
  architecture, not a rare edge case.
- No payment gateway — GCash has no self-serve checkout API for an
  event this size on this timeline, so payment is proof-of-payment
  (receipt screenshot + reference number) reviewed by hand, not automated.
- No Docker or local Supabase on the dev machine; schema changes are pasted
  by hand into the hosted project's SQL editor.
- Hosted on Vercel — HTTPS is required for the door scanner's camera access,
  which browsers block on insecure origins.

## Capabilities and Constraints

- Checkout, admin review queue, ticket page with QR, door scanner
  (offline-tolerant, multi-device), attendance dashboard with `.xlsx`
  export, and a raffle (server-side draw, admin-managed prizes, an explicit
  admin-only supplement for names the scanner missed) are all built.
- Eligibility for the raffle defaults to "scanned in at the door" — the
  entire reason the QR ticket system exists rather than a simpler list. An
  admin can opt added names into a specific draw, but this is a deliberate,
  visible exception, never the default.
- No hidden-field honeypot on checkout, deliberately — browser/extension
  autofill silently killed a real submission once. A submission throttle
  and a unique GCash-reference index are the actual anti-abuse layers.
- Out of scope, deliberately, for this event: refunds, ticket transfers,
  waitlists, seat assignment, multiple ticket tiers, group purchasing,
  discount codes, a native mobile app.
- The GCash payee name and number in `src/lib/config/event.ts` are still
  placeholders — this must be replaced with the real account before ticket
  sales open. Flagged here so redesign work doesn't treat it as final copy.

## Brand Commitments

- Event name: **Acquaintance Party**, hosted by the **BSIT Department**.
- Theme: **Sunset Soiree**, confirmed 2026-09-02 (Coachella-inspired: burnt
  clay, sun gold, sand, dusk plum). Built under the working codename
  "Desert Sundown"; the palette needed no changes once the name was
  confirmed — see `src/lib/config/theme.ts`.
- Type: Anton (display, uppercase, festival-poster feel) + DM Sans (body).
- No logo, mascot, or photography exists. The identity is entirely
  typographic and color-driven — stays that way; no fabricated imagery.

## Evidence on Hand

- A real GCash QR screenshot for payment (`public/gcash-qr.png`) — the only
  real asset in the project. No event photography, no BSIT department logo
  file, no testimonials or past-event data.
- `context/PRD.md`, `context/DESIGN.md`, `context/ARCHITECTURE.md`,
  `context/SCHEMA.md`, `context/RULES.md` — the project's own fast-reference
  docs, already detailed and current. The full reasoning behind decisions
  lives in `docs/superpowers/specs/` and `docs/superpowers/plans/`.
- State absence future work must not fabricate: no student testimonials, no
  attendance numbers from a past event (this event hasn't happened yet), no
  press or case-study material.

## Product Principles

1. **The door and the money are load-bearing; the theme is not.** Checkout,
   review, and the scanner shipped and were hand-verified before any visual
   polish — a broken raffle wheel is an inconvenience, a broken checkout
   loses real money.
2. **Trust over persuasion.** Students are already committed to attending;
   the design's job is to make paying, waiting for approval, and showing up
   feel legible and safe, not to convert skeptics.
3. **Mobile-first because that's the only real usage pattern**, not a
   responsive-design afterthought. Every public surface is designed and
   tested at phone width first.
4. **Function-first surfaces stay function-first.** Admin, the door
   scanner, and the raffle projector each have a documented, deliberate
   reason to depart from or restrict the public theme (see
   `context/DESIGN.md` §3) — a redesign pass must not blur that line for
   the sake of visual consistency.
5. **No invented content.** No fabricated testimonials, stats, imagery, or
   claims — the copy and assets that exist are the copy and assets to
   design with.

## Accessibility & Inclusion

Documented standard already in force (`context/DESIGN.md` §6): 4.5:1
contrast for body text, 3:1 for large display type; `--color-accent` on
`--color-ground` passes for headlines only, never body copy at small sizes;
every interactive element needs a visible focus state.
