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
- [ ] Google Sheets live sync
- [ ] Landing page visual polish
- [ ] Two-stage raffle wheel (shortlist → spin), server-side draw

Status as of this file's writing: **plan 1 and plan 2 of 3 are both done and
verified** — plan 1 ("sell and verify") by hand-clicking checkout → review →
ticket → QR with a real phone camera; plan 2 ("door operations") by a
two-phone rehearsal against the live production deployment, not just
localhost. See `docs/superpowers/plans/` for the authoritative task lists.

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
