# PRD.md — Product Requirements

Condensed from the full design spec:
`docs/superpowers/specs/2026-08-30-acquaintance-party-ticketing-design.md`.
Read that for the *why* behind any decision below — this file is the fast
summary, not the source of truth.

## 1. Problem
A school acquaintance party needs to sell tickets to 600+ students, verify
GCash payments, issue QR tickets, scan them at the door on unreliable venue
wifi, record attendance for a raffle, and run the raffle draw itself. The
event is under two weeks out from 2026-08-30.

## 2. Target users
- **Student** — buys a ticket, pays via GCash, uploads a receipt, gets a QR.
  Mobile-first; this is filled out on a phone.
- **Admin** — reviews receipts, approves/rejects, scans at the door, runs the
  raffle. A handful of people, likely also on phones at the door.

## 3. Why not a payment gateway
GCash has no self-serve checkout API. A real gateway (PayMongo/Xendit/Maya)
needs merchant onboarding with business documents, approved in days to
weeks — not viable in two weeks. So payment is **proof of payment + manual
admin approval**, not a compromise but the only option that ships in time.

## 4. Scope — MVP module set
- [x] Event/theme config (`src/lib/config/event.ts`, `theme.ts`)
- [x] Database schema + RLS (`supabase/migrations/0001_init.sql`)
- [x] Checkout — name, year level, section, email, GCash reference, receipt
      upload
- [x] Duplicate-reference detection (unique index) + orphaned-upload cleanup
- [x] Admin auth (Supabase, signup disabled, accounts created by hand)
- [ ] Admin review queue — approve/reject with reason
- [ ] Ticket page with QR (code generation done; page not yet built)
- [ ] Honeypot + submission throttle
- [ ] Admin search (find a lost ticket by name/email)
- [ ] Door scanner — offline-tolerant, multi-device
- [ ] Attendance dashboard + `.xlsx` export
- [ ] Google Sheets live sync
- [ ] Landing page visual polish
- [ ] Two-stage raffle wheel (shortlist → spin), server-side draw

Status as of this file's writing: **plan 1 of 3 ("sell and verify"), 7 of 11
tasks complete.** See `docs/superpowers/plans/` for the authoritative task
list and what each plan covers.

## 5. Explicitly out of scope
Refunds, ticket transfers, waitlists, seat assignment, multiple ticket tiers,
group purchasing, discount codes, a native mobile app. All addable later
without a schema rewrite, none needed for this event.

## 6. Key constraints that shape every decision
- **600+ attendees, <2 weeks runway** — cuts land on the last build items
  (raffle, Sheets sync, landing polish), never on checkout/review/scanner.
- **No Docker, no local Supabase** — migrations are pasted by hand into the
  hosted project (`docs/setup/supabase.md`), not pushed via CLI.
- **Unreliable venue wifi** — the scanner must work offline and sync later,
  which means cross-device duplicate prevention isn't perfect in a blackout.
  Accepted tradeoff — see the spec's §Scanner.
- **HTTPS required** — browser camera access for the scanner is blocked on
  insecure origins. Deploy to Vercel before starting plan 2.

## 7. Success criteria (plan 1)
A student can pay, submit details + receipt, land on a permanent ticket
link. A reused GCash reference is rejected with no orphaned file left
behind. An admin can review, approve, or reject with a reason. An approved
student's QR decodes on a real phone camera to their bare ticket code.
