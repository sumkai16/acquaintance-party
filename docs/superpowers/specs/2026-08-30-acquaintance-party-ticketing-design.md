# Acquaintance Party Ticketing System — Design

**Date:** 2026-08-30
**Status:** Approved, pending implementation plan

## Problem

A school acquaintance party needs to sell tickets to 600+ students, verify GCash
payments, issue QR-code tickets, scan those tickets at the door on a venue with
unreliable internet, record attendance to a Google Sheet, and run a live
spin-the-wheel raffle from the attendees who actually showed up.

The event is under two weeks away. Every design decision below favors shipping a
working critical path over completeness.

## Constraints

These are fixed inputs, not choices open for revisiting during implementation.

| Constraint | Value |
| --- | --- |
| Attendees | 600+ |
| Runway | Under two weeks from 2026-08-30 |
| Payment | Proof of payment + manual admin approval |
| Ticket delivery | Permanent ticket URL; email best-effort |
| Door scanners | 2–4 phones, unreliable venue connection |
| Ticket types | Single fixed price, one ticket per registration |
| Attendance record | Live Google Sheet sync, plus `.xlsx` export fallback |
| Raffle | Two-stage shortlist wheel, drawn from checked-in students |

### Why not a payment gateway

The original plan proposed redirecting students to GCash for automatic payment.
GCash has no self-serve checkout API. Reaching it requires a Philippine payment
gateway — PayMongo, Xendit, or Maya — and merchant onboarding at all three
requires submitting business registration documents, with approval taking days
to weeks. That cannot be live in under two weeks.

Gateway fees (~2.5% on GCash) are also charged to the merchant, deducted from
settlement, with funds landing in the org's bank account 2–7 days later rather
than instantly.

The proof-of-payment flow is therefore not a compromise for this event. It is
the only option that ships.

## Architecture

**Next.js 15 (App Router, TypeScript, Tailwind) on Vercel, with Supabase for
Postgres, file storage, and admin auth.**

One repository, one deploy, two service accounts. Supabase covers four needs
that would otherwise be four separate vendors: the database, private storage for
receipt screenshots, authentication for admins, and realtime updates for the
review queue. Free tiers cover 600 registrations with substantial headroom.

Rejected alternatives:

- **Neon/Vercel Postgres + Cloudinary + NextAuth** — identical outcome,
  four accounts instead of two, more configuration surface, no benefit.
- **Google Forms + Sheets + Apps Script** — buildable in a day, but loses the
  e-commerce landing page entirely, has no real scanner UI, and cannot prevent
  double entry. Retained only as an emergency fallback if the build stalls.

### External services required

| Service | Purpose | Cost | Set up by |
| --- | --- | --- | --- |
| Supabase project | Postgres, storage, auth | Free tier | Day 1 (blocks everything) |
| Vercel project | Hosting, HTTPS | Free tier | Day 1 |
| Google Cloud service account | Sheets API write access | Free | Before Sheets sync step |
| Resend + verified domain | Ticket emails | ~₱600/yr domain | Optional, non-blocking |

HTTPS is mandatory, not optional: browser camera access for the scanner is
blocked on insecure origins. Vercel provides it.

## Data model

One fixed price with no group purchasing means one registration *is* one ticket.
No separate orders table.

### `registrations`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid, pk | |
| `full_name` | text | |
| `year_level` | text | |
| `section` | text | |
| `email` | text | Personal email |
| `gcash_reference` | text | 13 digits; **unique index** |
| `receipt_path` | text | Key into private storage bucket |
| `amount` | integer | Centavos, from event config |
| `status` | enum | `pending` \| `approved` \| `rejected` |
| `reject_reason` | text, null | Shown to the student on their ticket link |
| `ticket_code` | text, null | Opaque; generated on approval only |
| `created_at` | timestamptz | |
| `reviewed_at` | timestamptz, null | |
| `reviewed_by` | uuid, null | Admin user id |

### `scans`

Append-only. Separate from `registrations` because offline scanners sync late
and reconciliation needs the full history, not a boolean.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid, pk | |
| `registration_id` | uuid, fk, null | Null when the code matched nothing |
| `scanned_at` | timestamptz | Device clock at scan time |
| `synced_at` | timestamptz | Server clock at insert |
| `device_label` | text | e.g. `door-1`, set per scanner |
| `result` | enum | `ok` \| `duplicate` \| `invalid` |

### `prizes`

`id`, `name`, `sort_order`, `drawn` (boolean).

### `raffle_draws`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid, pk | |
| `prize_id` | uuid, fk | |
| `winner_registration_id` | uuid, fk | |
| `finalists` | jsonb | The 12 shortlisted registration ids |
| `pool_size` | integer | Eligible count at draw time |
| `drawn_at` | timestamptz | |
| `drawn_by` | uuid | Admin user id |
| `is_redraw` | boolean | |
| `supersedes` | uuid, fk, null | The draw this replaced |

`supersedes` makes a no-show redraw visible in the record rather than silently
overwriting history.

### Row-level security

RLS on for every table. The public role can insert a `registrations` row and
read a single row by `ticket_code`, nothing more. All admin reads and writes go
through authenticated server-side routes. Receipt images live in a **private**
bucket, served to admins only via short-lived signed URLs.

## Student flow

1. **Landing page** — event theme, hero, details, single product card. Styled to
   read as e-commerce, per the reference sites.
2. **Checkout** — full name, year level, section, personal email.
3. **Payment** — the org's GCash QR and number displayed. Student pays in the
   GCash app, then uploads the receipt screenshot and types the 13-digit
   reference number.
4. **Confirmation** — a permanent ticket URL, with clear instructions to
   bookmark or screenshot it.
5. **Ticket page** — shows "pending review" until an admin approves, then flips
   to display the QR code with the student's name, year level, and section. If
   rejected, shows the reason and how to resubmit.

### Fraud prevention

The GCash reference number is the primary lever. It is unique per real
transaction, so a `unique` index catches a recycled screenshot automatically,
before an admin looks at it. The admin review screen surfaces the duplicate
warning in red alongside both registrations.

Secondary measures: rate limiting on the submit endpoint, a honeypot field, an
image size and MIME allowlist on upload, and required-field validation on the
reference number format.

This does not stop a forged screenshot with a fabricated reference number. That
is what human review is for — the admin cross-checks against the GCash
transaction history for the receiving account.

## QR ticket

The QR encodes **only an opaque random code** — 16 characters, base32,
generated with a CSPRNG at approval time. Not the registration UUID, not a
signed token, not any personal data.

Rationale: photographing a stranger's ticket then reveals nothing, and the
ticket is single-use anyway. A signed JWT was considered and rejected — offline
scanners must carry a local ticket manifest regardless, in order to display
names and detect duplicates, so signature verification would buy nothing while
making the QR denser and slower to scan.

## Scanner

A web page at `/admin/scan`, installable to a phone home screen.

**Online:** downloads the full approved-ticket manifest (code, name, year level,
section, checked-in state) into IndexedDB. At 600 rows this is roughly 60KB and
loads instantly. Refreshes every 60 seconds so late approvals appear.

**Scanning:** resolves entirely on-device against the local manifest. Large
green result with the student's name and section, or large red with the reason —
`already scanned at 8:14pm`, or `not a valid ticket`.

**Syncing:** every scan is queued in IndexedDB and pushed to the server,
retrying on an interval until it lands. Nothing is lost to a dropped connection.

**Camera:** native `BarcodeDetector` where available (Android Chrome), falling
back to `@zxing/browser` (iOS Safari, which lacks it).

### Accepted limitation

Offline tolerance and real-time cross-device duplicate prevention are mutually
exclusive. During a signal blackout, two phones cannot coordinate, so the same
ticket could pass at two different doors.

Mitigation is procedural plus after-the-fact: each scanner gets a distinct
`device_label` and a distinct physical lane, and the dashboard raises a
double-scan alert the moment devices reconnect. Given a venue with unreliable
internet, losing the ability to scan at all would be far worse than a
theoretical double entry.

## Admin

Supabase email/password auth against an allowlist of admin accounts.

- **Review queue** — receipt image displayed beside the entered reference
  number and amount, duplicate-reference warnings in red, approve/reject with
  reason. Realtime, so multiple admins reviewing simultaneously don't collide.
- **All registrations** — searchable by name or email, for students who lose
  their ticket link. This will happen; it is a primary support path, not an edge
  case.
- **Scanner** — as above.
- **Dashboard** — checked-in count against tickets sold, scan rate,
  double-scan alerts.

## Attendance record

**Live Google Sheets sync.** A Google Cloud service account, with the target
Sheet shared to its email address, appends a row on every scan. Anyone with the
Sheet open watches attendance fill in during the event.

**`.xlsx` export fallback.** A one-click export on the dashboard. This exists
because a Sheets credential or quota failure at 8pm on event night would
otherwise leave nothing recoverable in the moment. It is a small amount of code
and converts a disaster into an inconvenience.

Postgres remains the source of truth in both cases. The Sheet is a projection.

## Raffle

**Eligibility:** students who actually scanned in. This is the point of the QR
system — it gives every student a concrete reason to be scanned rather than
slipping in.

**The draw is server-side.** A single request selects 12 finalists and the
winner from the eligible pool using a cryptographic RNG, and returns both. The
outcome is fully decided before any animation begins, so a wifi hiccup mid-spin
cannot break or alter the result.

Client-side selection was rejected outright: it is riggable by anyone who opens
devtools, and a prize draw needs to survive being questioned.

**Presentation, two stages:**

1. 600 names blur past, narrowing to 12 finalists.
2. Those 12 go on a readable wheel — legible slices, unlike 600 at 0.6° each —
   which spins and resolves to the winner. Name, year level, and section
   revealed large.

Full-screen dark layout sized for a projector. The eligible pool is loaded
before the draw so the display survives a connection drop.

**Mechanics:**

- Multiple prizes, drawn one at a time in `sort_order`.
- Previous winners excluded by default; toggleable.
- Pool refreshes immediately before each spin, so late arrivals are included.
- **Redraw** for a no-show winner, recorded as `is_redraw` with `supersedes`
  pointing at the original — transparent rather than looking like someone quietly
  reran it until they liked the answer.

**Optional, deferred:** publish a hash of the random seed before the event and
reveal the seed afterward, making the draws externally verifiable. Roughly an
hour of work. Include only if the org asks for it.

## Configuration

Event theme, name, date, venue, ticket price, GCash number and QR image, and
capacity all live in a single config file. Changing the price or venue must not
require a code change.

## Build order

Strictly critical-path first. If the schedule slips, the cut line falls on the
last items, which have manual fallbacks.

1. Supabase project, schema, RLS
2. Landing page skeleton and checkout form
3. Receipt upload to private storage
4. Admin auth and review queue
5. Ticket page with QR generation
6. Scanner with offline manifest and sync queue
7. Dashboard and `.xlsx` export
8. Google Sheets live sync
9. Landing page visual polish
10. Raffle wheel

The landing page is polished at step 9 deliberately: it is the piece that can
become beautiful in the final days without blocking anything upstream. The
raffle is last because a manual draw from the exported sheet is a workable
fallback, whereas manual check-in of 600 people is not.

## Visual design

**The party theme is not finalized.** The current working theme is Coachella,
and the default visual direction is "Desert Sundown," but this may change.

Because of that, the visual identity is **tokenized, not hardcoded**. A theme
change late in a two-week build is a schedule risk only if the palette is spread
across every component. Confined to one file, it is a fifteen-minute edit. This
costs almost nothing to design in now and is expensive to retrofit.

### Theme tokens

A single source of truth — six colors and two typefaces — exposed as CSS custom
properties on `:root` and imported from one config module.

| Token | Default (Desert Sundown) | Role |
| --- | --- | --- |
| `--accent` | `#C2481F` burnt clay | Primary actions, headlines |
| `--accent-2` | `#E39824` sun gold | Highlights, poster title |
| `--accent-3` | `#7E8B5F` cactus sage | Tertiary, chart and badge fills |
| `--deep` | `#3B2136` dusk plum | Hero ground, inverted sections |
| `--ground` | `#F2E3CB` sand | Page background |
| `--ink` | `#2E1D16` | Body text |

Typography: **Anton** (display) and **DM Sans** (body), loaded from Google Fonts.
Both are named in the same config module.

### What a theme change actually costs

**Cheap** — palette, typefaces, event copy, hero background treatment. Config
edit plus a font link.

**Not cheap** — a hero built around a theme-specific conceit. The Coachella
lineup-poster device (centered stacked caps, tiny bulleted activity list) is
specific to this theme and would not survive a switch to, say, a masquerade or
Y2K theme.

Mitigation: **the hero's structure stays theme-neutral** — eyebrow, display
title, date line, feature row, call to action. The festival reading comes from
the type and color choices filling that structure, not from the structure
itself. Any theme can inhabit it without a rebuild.

### Rules that hold regardless of theme

These are not style preferences and must not be overridden by a theme change.

- **The QR always sits on a plain white card** with a clear quiet zone. Phone
  cameras reject codes rendered on warm, textured, or low-contrast grounds. The
  theme lives in the ticket header and stops at the white card.
- **The scanner uses semantic color only** — green, red, amber — never the theme
  accent. It is read at arm's length, in the dark, by a volunteer under time
  pressure. One state fills the screen at a time, and every state names a next
  action, including the failure case (`search by name instead`). A dead end at
  the door with 600 people queued is not a survivable outcome.
- **The admin review queue stays neutral and dense.** Someone is working through
  600 receipts; decoration slows them down.
- **The raffle projector carries its own dark palette** regardless of the public
  theme. Light grounds glare in a dark room. Default is an indigo and magenta
  set ("Night Set"), which also gives the draw a deliberate shift in energy.
- **Contrast targets:** 4.5:1 for body text, 3:1 for large display type. Accent
  on ground passes for headlines only — body copy always uses `--ink`.

### Surface treatment summary

| Surface | Treatment |
| --- | --- |
| Landing, checkout | Full theme |
| Ticket page | Themed header, white QR card |
| Raffle projector | Full theme, own dark palette |
| Door scanner | Semantic color only, function first |
| Admin review, dashboard | Neutral, dense |

### Deferred

Event name, tagline, date, venue, ticket price, and any existing org branding
(logo, department colors, an already-designed poster) are unknown. All live in
the config file. **Existing org material, if it surfaces, wins over anything
specified here.**

## Out of scope

Refunds, ticket transfers, waitlists, seat assignment, multiple ticket tiers,
group purchasing, discount codes, and a native mobile app. None are needed for
this event and all can be added later without restructuring the schema.
