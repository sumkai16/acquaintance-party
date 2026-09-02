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
- [x] Checkout — name, year level, section, email, GCash reference, receipt
      upload
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

Status as of 2026-09-02: **all three plans are written and implemented.**
Plan 1 ("sell and verify") was verified by hand-clicking checkout → review →
ticket → QR with a real phone camera; plan 2 ("door operations") by a
two-phone rehearsal against the live production deployment, not just
localhost. Plan 3's code is committed but **not yet hand-verified end to
end** — `0002_raffle.sql` and `0003_raffle_prizes_and_entrants.sql` still
have to be pasted into the hosted project before `/admin/raffle` runs at
all, and the raffle wants one rehearsal with real checked-in rows on the
actual projector. See `docs/superpowers/plans/` for the authoritative task
lists.

**Raffle prizes and the entrant list are admin-managed, not config.** An
early version of the raffle hardcoded three prizes (Third/Second/Grand) in
`src/lib/config/event.ts` — changing them needed a code edit and a redeploy.
That didn't fit how the raffle is actually run: prizes and their count are
decided at the podium, and they're now added, renamed, reordered, and
removed from `/admin/raffle` itself. The eligible pool also gained an
explicit, admin-only supplement — add a name by hand, or import a short
list from Excel — for someone the scanner missed. The scanned-in pool stays
the default and the primary eligibility path; this is an escape hatch, not
a second way in.

Added names still sit outside a specific draw until the operator includes
them — a per-draw **"Only scanned QR tickets"** toggle next to "exclude
previous winners" lets a prize be run strictly against ticket-holders, with
added names left out for that draw specifically. Setup stays a roster you
manage; whether a name counts is decided draw by draw.

**The raffle's "600 names blur past" shortlist stage was cut, deliberately
diverging from the spec.** It never actually scaled with participant count
(capped at 80 decoy names, a fixed ~4s) — the real cost was that fixed 4
seconds landing on *every* draw and redraw, which adds up drawing several
prizes live. Speed at the podium won over the shortlist drama; the draw
click now goes straight to the wheel.

**The theme is confirmed: Sunset Soiree** (2026-09-02). The palette built
under the internal codename "Desert Sundown" needed no changes to fit it —
`src/lib/config/theme.ts` and `context/DESIGN.md` §0 are updated, tokens
untouched.

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
