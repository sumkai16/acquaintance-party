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
- [ ] Door scanner — offline-tolerant, multi-device
- [ ] Attendance dashboard + `.xlsx` export
- [ ] Google Sheets live sync
- [ ] Landing page visual polish
- [ ] Two-stage raffle wheel (shortlist → spin), server-side draw

Status as of this file's writing: **plan 1 of 3 ("sell and verify") is
code-complete, 11 of 11 tasks.** Every task was verified with automated
tests and scripted checks against the live database, but **no task has yet
been clicked through by hand in a browser** — that pass, including scanning
a real approved ticket's QR with an actual phone camera, is still
outstanding before plan 1 can be called done. See `docs/superpowers/plans/`
for the authoritative task list and what each plan covers.

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
- **Unreliable venue wifi** — the scanner must work offline and sync later,
  which means cross-device duplicate prevention isn't perfect in a blackout.
  Accepted tradeoff — see the spec's §Scanner.
- **HTTPS required** — browser camera access for the scanner is blocked on
  insecure origins. Deploy to Vercel before starting plan 2.
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
