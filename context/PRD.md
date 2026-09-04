# PRD.md — Product Requirements

Condensed from the full design spec:
`docs/superpowers/specs/2026-08-30-acquaintance-party-ticketing-design.md`.
Read that for the *why* behind any decision below — this file is the fast
summary, not the source of truth.

## 1. Problem
A school acquaintance party needs to sell tickets to 600+ students, verify
GCash payments, issue QR tickets, scan them at the door on unreliable venue
wifi, record attendance for a raffle, and run the raffle draw itself.

**Event date confirmed 2026-08-31: Monday, 2026-10-05, 4–8 PM, SCC Annex
Building.** The project was originally scoped assuming under two weeks of
runway from 2026-08-30 — the actual gap turned out to be about five weeks.

## 2. Target users
- **Student** — buys a ticket, pays via GCash, uploads a receipt, gets a QR.
  Mobile-first; this is filled out on a phone.
- **Admin** — reviews receipts, approves/rejects, scans at the door, runs the
  raffle. A handful of people, likely also on phones at the door.

## 3. Why not a payment gateway
GCash has no self-serve checkout API. A real gateway (PayMongo/Xendit/Maya)
needs merchant onboarding with business documents, approved in days to
weeks. This ruled out a gateway outright under the original under-two-weeks
assumption.

**Revisited 2026-08-31**, once the real date (five weeks out) was confirmed:
kept proof-of-payment anyway, by deliberate choice, not because it no longer
fit. The flow was already built, tested, and working end to end — checkout,
review queue, QR tickets, Discord notifications. Switching to a gateway
trades that for new scope (a merchant account application with uncertain
approval timing, plus real API integration) to remove manual review, which
saves admin time rather than solving any real blocker. Revisit only if
manual review at 600 tickets turns out to be a genuine bottleneck.

## 4. Scope — MVP module set
- [x] Event/theme config (`src/lib/config/event.ts`, `theme.ts`)
- [x] Database schema + RLS (`supabase/migrations/0001_init.sql`)
- [x] Checkout — name, student ID, year level, section, email, GCash
      reference, receipt upload
- [x] Walk-in cash sales (admin-entered, approved on the spot)
- [x] Duplicate-reference detection (unique index) + orphaned-upload cleanup
- [x] Admin auth (Supabase, signup disabled, accounts created by hand)
- [x] Admin review queue — approve/reject with reason
- [x] Ticket page with QR
- [x] Submission throttle (honeypot tried and removed — see §6)
- [x] Admin search (find a lost ticket by name/email)
- [x] Door scanner — offline-tolerant, multi-device
- [x] Attendance dashboard + `.xlsx` export
- [x] Landing page visual polish
- [x] Raffle wheel, server-side draw
- [x] Google Sheets live sync
- [x] Confirmation emails (Resend) — see below

Status as of 2026-09-03: **all three plans are written and implemented.**
Plan 1 ("sell and verify") was verified by hand-clicking checkout → review →
ticket → QR with a real phone camera; plan 2 ("door operations") by a
two-phone rehearsal against the live production deployment, not just
localhost. Plan 3's migrations (`0002_raffle.sql`,
`0003_raffle_prizes_and_entrants.sql`, `0004_raffle_remove_prizes.sql`) are
pasted into the hosted project; the raffle still wants one rehearsal with
real checked-in rows on the actual projector. See
`docs/superpowers/plans/` for the authoritative task lists.

**Prizes aren't tracked in the app.** An early version hardcoded three
prizes (Third/Second/Grand) in `src/lib/config/event.ts`; a later version
moved them into an admin-managed `raffle_prizes` table. Both were removed —
what's being raffled off is decided and announced at the podium, and the
software's only job is picking a winner's name, in order, all night. The
raffle page shows a running list of who's won so far instead of a prize
list, and only the most recently drawn name is ever redrawable (not scoped
to a prize, since there isn't one). The eligible pool still has its
explicit, admin-only supplement — add a name by hand, or import a short
list from Excel — for someone the scanner missed. The scanned-in pool stays
the default and the primary eligibility path; this is an escape hatch, not
a second way in.

Scanned tickets are the pool by default — added names sit outside a specific
draw until the operator opts them in. A per-draw **"Include added names"**
toggle next to "exclude previous winners" pulls in anyone added under Setup
for that one draw; leave it off and the draw runs strictly against
ticket-holders. Setup stays a roster you manage; whether a name actually
counts is decided draw by draw.

**The raffle's "600 names blur past" shortlist stage was cut, deliberately
diverging from the spec.** It never actually scaled with participant count
(capped at 80 decoy names, a fixed ~4s) — the real cost was that fixed 4
seconds landing on *every* draw and redraw, which adds up across a night of
drawing several names live. Speed at the podium won over the shortlist
drama; the draw click now goes straight to the wheel.

**Rejections folded into Find a registration** (2026-09-04). A separate,
dedicated `/admin/rejections` page briefly existed for "easy access" to
who-rejected-what, but a standalone page browsing one status was really the
same table as Find a registration with a filter applied. `searchRegistrations()`
now takes an optional status (`all` | `pending` | `approved` | `rejected`)
and browses without a query when one is picked — a filter-pill row under
the search box replaces the separate page and its nav entry. Search and a
status filter combine (e.g. "santos" within Rejected only) — see the
layout-consistency entry below for how this is actually presented now.

**One shared table for every admin list** (2026-09-04). Results on Find a
registration moved from a card list to a table "just like Attendance,"
and that consistency is now real, not visual coincidence:
`src/app/admin/table.tsx` exports `Table`/`Th`/`SortHeaderLink`/
`SortHeaderButton`/`Tr`, and Attendance, Review Queue, and Find a
registration are all built from them. `SortHeaderLink` is for a page whose
sort lives in the URL (Attendance, Find a registration); `SortHeaderButton`
is for Review Queue's deliberately client-side, URL-free instant search
(see the comment in `review-table.tsx` — the pending queue is small enough
that an admin triaging it wants as-you-type filtering, not a page reload
per keystroke; that reasoning didn't change, only the markup it renders
through). Find a registration's table sorts by the same three columns
Review Queue already did (name/amount/submitted) via a new pure
`sortRegistrations()` in `src/lib/registrations/sort.ts`, mirroring
`sortScans()`. Review Queue's header row lost its `bg-ground/5` band and
its table its explicit `min-w-[840px]` — both existed only because nothing
forced consistency with Attendance before.

**Full page-layout consistency across the three admin lists** (2026-09-04,
same day, one round of feedback later — "consistency" turned out to mean
the whole page, not just the `<table>`). Review Queue and Find a
registration now follow Attendance's exact structure: an `<h1>` +
subtitle header, then an `mt-8` row pairing a small section heading
("Pending" / "Results") with the filter controls, then the table two
spacing units below. Find a registration dropped its centered gradient
hero entirely — the "single-focus search screen" framing chosen earlier
this session was explicitly reversed in favor of matching the other two
pages. Its search+status controls became a new client component,
`registration-filters.tsx`, built the same way `scan-filters.tsx` already
was: the text field debounces, the status `<select>` navigates instantly,
no submit button. Landing on the page with no filter now defaults to
`status=all` and shows the 50 most recent registrations immediately,
same as Attendance always showing Recent Scans without requiring a filter
first.

**Rejection accountability, and a door filter** (2026-09-04, same QA pass,
the two Mid-priority items). `registrations.reviewed_by`/`reviewed_at` were
already populated on every approve or reject, just never displayed —
**Find a registration** now shows "Rejected by `<email>` on `<date>`" on a
rejected row, resolving the admin's email from Supabase Auth via a new
`listAdminEmails()` (there's no admin profile table to join against). The
Recent Scans filters gain a fourth dropdown, Door, alongside Name/Year/
Section — same pattern, and included in the filtered `.xlsx` export too.

**Attendance search and a filtered export** (2026-09-04, same QA pass). The
Recent Scans table now has a debounced name search alongside the existing
Year-level/Section dropdowns; the invalid-QR message the QA doc asked for
already existed (the scanner's full-screen "Not a valid ticket" panel), so
that item needed no change. "Download .xlsx" carries whatever name/year/
section filter is active on the page through to the export — filter to a
section, download, and the file only has that section; no filter downloads
everything, same as before.

**Walk-in cash sales and the one-registration-per-student cap** (2026-09-04,
from a QA pass in `docs/Event Scanner.xlsx`) — two related gaps: nothing
stopped a student submitting several online registrations, and there was no
way to record a student who pays cash in person instead of GCash. Both are
now keyed on a new required `student_id` field, collected on every
registration regardless of how it was paid. A student can have at most one
non-rejected registration at a time (`registrations_student_id_active_key`,
a partial unique index — see `context/SCHEMA.md`); it reopens automatically
if that registration is rejected, or an admin can free it explicitly via a
new **Void** action on **Find a registration**, which works on an approved
row too (Review Queue's own reject only ever sees pending ones). Walk-in
sales are entered by staff at `/admin/walk-in` — no GCash reference or
receipt, approved immediately since the cash is already in hand — and get
the same confirmation email an online approval does, just no Discord ping,
since there's nothing left to review.

**The theme is confirmed: Sunset Soiree** (2026-09-02). The palette built
under the internal codename "Desert Sundown" needed no changes to fit it —
`src/lib/config/theme.ts` and `context/DESIGN.md` §0 are updated, tokens
untouched.

**An Impeccable dual-agent critique of landing/checkout/ticket, run once the
theme was confirmed, scored the flow 30/40 ("Good") and found five real
issues** — full report at `.impeccable/critique/2026-09-02T17-09-07Z__public-checkout-flow-landing-checkout-ticket-page.md`.
All five were fixed the same session, in the confirmed priority order:
1. **Confirmation emails** (new — see `docs/setup/resend.md`). The email
   field's stated purpose was "so we can find it if you lose the link," but
   nothing was ever sent to it; only a Discord webhook fired, for admins. A
   student is now emailed on submit and again on approval, with a working
   ticket link, via Resend (`src/lib/notify/email*.ts`, mirroring the
   `discord*.ts` pure/impure split). Optional — checkout and approval both
   work the same without it configured.
2. **Contrast fixes.** The CTA/Submit button labels (`text-ground` on
   `bg-accent`) computed to 3.9:1 against the project's own documented 4.5:1
   standard (`context/DESIGN.md` §6) — now `text-white`, 4.95:1. Muted text
   (`text-ink/60`, ~4.0:1) is now `text-ink/70`, ~5.3:1, standardized across
   landing, checkout, and the ticket page.
3. **Mobile checkout QR.** The 240px QR image forced a long scroll past
   content a phone mostly can't use (can't scan its own screen) before
   reaching the form. Now behind a `<details>` disclosure on mobile only,
   reusing the landing FAQ's exact pattern; desktop is unchanged.
4. **Trust signal.** One line under the payee block — deliberately generic,
   naming no unverified channel — since the account currently shown is still
   the placeholder `JUAN D. CRUZ` / `09171234567` flagged elsewhere in this
   file as needing to change before sales open.
5. **Review-time copy.** Replaced vague "not instant" language with an
   honest process explanation rather than a fabricated time bound — no past
   event exists to source a real number from.

**Plan 3 was built in a different order than the spec's** (landing → raffle
→ Sheets, not Sheets → landing → raffle). The spec's order was set assuming
under two weeks of runway, where the last item was the cut candidate. With
five weeks and ticket sales about to open, the landing page was the only
item affecting anyone before event day, and the raffle is the largest piece
and wanted the most testing buffer. Sheets sync went last because it is the
one item whose loss costs nothing but convenience.

Plan 2's rehearsal caught two real bugs that automated tests and a
single-device test couldn't have: the manifest only ever carried ticket
data, never telling a device what *other* devices had already scanned — so
cross-device duplicate detection silently never worked, not even with a
perfect connection. Fixed by having the manifest also carry each ticket's
earliest known check-in time, which the scanner absorbs into its local
duplicate-check state on every refresh. Second, a ticket approved after a
scanner's last manifest fetch read as "not a valid ticket" until the next
60-second refresh — fixed with a manual "Refresh tickets" button, since
admins approving stragglers while people queue at the door is a real event
scenario, not just a test artifact.

**Admin is fully themed as of 2026-09-03**, reversing what had been a hard
rule all session (`context/DESIGN.md` §3/§5's "neutral, dense, no accent").
Driven by Figma mockups the user provided for five surfaces — Find a
registration, Raffle, Attendance, Scanner, Review queue — and confirmed
explicitly, twice, over the two real tradeoffs this raised:
- **The raffle projector's separate dark "Night Set" palette was retired**
  in favor of one consistent Sunset Soiree language across admin and the
  raffle. It wasn't found broken — it was built deliberately (a dark room,
  a projector, the sand palette would glare) and dropped anyway by explicit
  user choice, confirmed with the projector-glare tradeoff stated plainly
  before the decision was made.
- **The door scanner's live scan result screens (green/red/amber) are the
  one surviving carve-out**, explicitly confirmed rather than assumed: only
  the pre-scan "Name this scanner" setup screen is themed. The reasoning
  that kept it out — read at arm's length, in the dark, under time
  pressure — is unchanged from the original neutral-admin rule; it's just
  no longer applied to setup screens or the rest of admin.

Admin login is the one built surface not yet themed — out of scope for the
mockups provided, flagged rather than silently expanded into. No schema,
server action, or business logic changed; purely visual/interaction-layer,
and the existing 117-test suite passed unmodified.

## 5. Explicitly out of scope
Refunds, ticket transfers, waitlists, seat assignment, multiple ticket tiers,
group purchasing, discount codes, a native mobile app. All addable later
without a schema rewrite, none needed for this event.

## 6. Key constraints that shape every decision
- **600+ attendees, ~5 weeks runway to 2026-10-05** (revised 2026-08-31 from
  an original under-two-weeks assumption — see §3). The build order still
  lands cuts on the last items (raffle, Sheets sync, landing polish) rather
  than checkout/review/scanner, since that priority never depended on the
  timeline being tight, only on which pieces are load-bearing at the door.
- **No Docker, no local Supabase** — migrations are pasted by hand into the
  hosted project (`docs/setup/supabase.md`), not pushed via CLI.
- **Unreliable venue wifi** — the scanner must work offline and sync later.
  Cross-device duplicate detection works as long as both devices have
  signal (a device learns what others scanned via its manifest refresh, or
  immediately via the manual refresh button) — it only fails during an
  actual signal blackout, which is the genuinely accepted tradeoff. See the
  spec's §Scanner and §6 in `docs/superpowers/plans/2026-08-31-door-operations.md`.
- **HTTPS required** — browser camera access for the scanner is blocked on
  insecure origins. Production is on Vercel at `https://it2026.vercel.app`
  (renamed from `acquaintance-party.vercel.app`, which no longer resolves —
  update any shared links).
- **No hidden-field honeypot on checkout.** One was built and removed the
  same day: browser/extension autofill silently filled the off-screen field
  with a real name on a real student's first submission, killing it with no
  error shown — confirmed live, not theoretical. The unique GCash reference
  index and the submission throttle are the actual anti-abuse layers; don't
  re-add a honeypot to this form without solving the autofill problem first.

## 7. Success criteria (plan 1)
A student can pay, submit details + receipt, land on a permanent ticket
link. A reused GCash reference is rejected with no orphaned file left
behind. An admin can review, approve, or reject with a reason. An approved
student's QR decodes on a real phone camera to their bare ticket code.

## 8. Success criteria (plan 2)
Two phones, both signed in and running the scanner, can admit and reject
tickets with no network at all. Putting both phones offline and scanning the
same ticket on each is expected to double-admit — that is the accepted
tradeoff — and the dashboard's double-scan panel names the ticket and both
doors afterward. With both phones online, scanning the same ticket twice
across devices is caught as a duplicate. An admin can download a `.xlsx`
covering every scan from every device.
