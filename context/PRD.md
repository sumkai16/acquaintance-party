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

**Corrected 2026-09-06: the event moved to Saturday, 2026-10-03**, 4–8 PM,
same venue — two days earlier than the date above. Runway math elsewhere in
this doc ("~5 weeks") still holds at this precision; nothing else in §3's
reasoning changes.

**Corrected 2026-09-15: start time moved to 2:30 PM**, still ending 8 PM,
same date and venue.

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
Payments, QR tickets, Discord notifications. Switching to a gateway
trades that for new scope (a merchant account application with uncertain
approval timing, plus real API integration) to remove manual review, which
saves admin time rather than solving any real blocker. Revisit only if
manual review at 600 tickets turns out to be a genuine bottleneck.

## 4. Scope — MVP module set
- [x] Event/theme config (`src/lib/config/event.ts`, `theme.ts`)
- [x] Database schema + RLS (`supabase/migrations/0001_init.sql`)
- [x] Checkout — name, student ID, year level, section, email, GCash
      reference, receipt upload (reference read off the receipt in the
      browser — see below)
- [x] Walk-in cash sales (admin-entered, approved on the spot)
- [x] Duplicate-reference detection (unique index) + orphaned-upload cleanup
- [x] Admin auth (Supabase, signup disabled, accounts created by hand)
- [x] Payments — approve/reject with reason; Pending/Approved/Rejected filter
- [x] Ticket page with QR
- [x] Submission throttle (honeypot tried and removed — see §6)
- [x] Admin search (find a lost ticket by name/email)
- [x] Door scanner — offline-tolerant, multi-device
- [x] Attendance dashboard + `.xlsx` export
- [x] Landing page visual polish
- [x] Raffle wheel, server-side draw
- [x] Google Sheets live sync
- [x] Confirmation emails (Resend) — see below
- [x] Staff accounts, cash remittance, activity log (`0007`)
- [x] Expenses — admin-recorded spend, deducted from cash/GCash on that page only (`0010`);
      optional receipt photo, Excel import and export (`0011`). No third-party
      scanning API — the phone's camera via a capture input, shrunk in the browser
- [x] Walk-in import batches (`0012`) — every bulk import keeps its original file;
      admins see who imported what at `/admin/imports` and can void a whole import at once
- [x] Partial walk-in payments (`0013`) — a walk-in cash sale can be recorded
      with any admin-entered amount, at least `EVENT.partialPaymentMinCentavos`
      (a flat floor, not a percentage); no QR goes out until staff or admin
      record the balance on `/admin/walk-in`. Online payments are unaffected — there is
      no partial concept for GCash
- [x] Acknowledgement receipts (`0014`) — one per payment, at `/receipt/<id>`, printed
      through the browser. Linked from the ticket/partial email; the Dashboard's
      **Receipts** card emails the backlog with an apology, QR included for anyone
      already paid in full. Replaces the old QR-only "Ticket emails" card

Status as of 2026-09-03: **all three plans are written and implemented.**
Plan 1 ("sell and verify") was verified by hand-clicking checkout → review →
ticket → QR with a real phone camera; plan 2 ("door operations") by a
two-phone rehearsal against the live production deployment, not just
localhost. Plan 3's migrations (`0002_raffle.sql`,
`0003_raffle_prizes_and_entrants.sql`, `0004_raffle_remove_prizes.sql`) are
pasted into the hosted project; the raffle still wants one rehearsal with
real checked-in rows on the actual projector. See
`docs/superpowers/plans/` for the authoritative task lists.

**The GCash reference is read off the receipt** (2026-09-14). Checkout's
receipt field moved above the reference field; picking an image runs
Tesseract (tesseract.js) in the student's browser and fills the reference
if it finds a thirteen-digit number, with a line asking them to check it
against the receipt. Chosen over a server-side vision model for being free,
keyless, and keeping the image on the device until submit. Tested against
real input: a clean GCash screenshot reads exactly in well under a second;
a blurry photo *of* a phone screen doesn't read at all, even with local
thresholding and a locate-then-reread pass (both tried, both dropped as not
worth the code). A miss just says "type it in" — the field never fills
unless `findGcashReference` sees exactly thirteen digits, and never
overwrites a number the student typed. The engine and English data load
from jsdelivr on first file pick, not on page load.

**Payments shows decided rows, not just the queue** (2026-09-14). A
Pending/Approved/Rejected dropdown (with counts) sits beside search and year
level; Pending is the default and the bare URL, the others are
`?status=approved|rejected`. Status is URL-driven because it decides what
the server fetches — Approved can run to hundreds of rows — while search and
year stay instant and client-side as before. Decided rows are read-only
("Approved by `<email>` on `<date>`" + ticket code, or the rejection reason);
undoing an approval stays on the Dashboard's Void. Duplicate-reference
counts and receipt signed URLs are now one batched call each, not one per
row.

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
`SortHeaderButton`/`Tr`, and Attendance, Payments, and Find a
registration are all built from them. `SortHeaderLink` is for a page whose
sort lives in the URL (Attendance, Find a registration); `SortHeaderButton`
is for Payments' deliberately client-side, URL-free instant search
(see the comment in `review-table.tsx` — the pending queue is small enough
that an admin triaging it wants as-you-type filtering, not a page reload
per keystroke; that reasoning didn't change, only the markup it renders
through). Find a registration's table sorts by the same three columns
Payments already did (name/amount/submitted) via a new pure
`sortRegistrations()` in `src/lib/registrations/sort.ts`, mirroring
`sortScans()`. Payments' header row lost its `bg-ground/5` band and
its table its explicit `min-w-[840px]` — both existed only because nothing
forced consistency with Attendance before.

**Full page-layout consistency across the three admin lists** (2026-09-04,
same day, one round of feedback later — "consistency" turned out to mean
the whole page, not just the `<table>`). Payments and Find a
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

**Attendance's fourth stat card swapped from "Invalid scans" to "Total
collected"** (2026-09-04). Invalid scans is an edge-case count (a bad QR, a
stale code) that's still visible per-row in Recent Scans (a red "INVALID"
badge) — it just stopped earning a dedicated summary card. A new
`totalCollectedCentavos()` in `src/lib/scans/queries.ts` (next to
`approvedCount()`, same file, same "registration data the dashboard needs"
reasoning) sums `amount` across every approved registration, online and
walk-in alike. `Stat`'s `value` prop widened from `number` to `number |
string` to render the formatted peso string; its now-unused `tone="warn"`
prop was dropped along with it, since nothing sets it anymore.

**The event name moved from the raffle page into the shared nav itself**
(2026-09-04). The raffle projector had its own "ACQUAINTANCE PARTY RAFFLE"
branding bar sitting directly under the shared `AdminNav` — a leftover from
when `AdminNav` "carried no branding" was the stated reason for adding it,
which read as two stacked bars once `AdminNav` started showing on every
page. `AdminNav` now renders `EVENT.name` as a small label on the left,
before the nav links, so every admin page gets it in the one bar instead
of raffle alone getting a redundant second one. Checked every other admin
page for the same pattern first (grepped for the distinctive
`tracking-[0.3em]` header class) — raffle was the only offender.

**Two follow-up fixes to that same nav bar** (2026-09-04, same day). The
brand label sat inside `AdminNav`'s `mx-auto max-w-5xl` column, so on any
screen wider than that it was inset from the true left edge instead of
flush against it — that div dropped the `max-w-5xl` constraint entirely
(the nav bar has no reason to mirror each page's own content width). And
the raffle page was unexpectedly scrollable: `admin/layout.tsx`'s wrapper
and raffle's own `<main>` both used `min-h-screen`, stacking to more than
100vh once `AdminNav`'s real height was added on top. Fixed by making the
layout wrapper `flex flex-col` and having raffle's `<main>` (and the
scanner setup screen's, same bug) use `flex-1` instead of its own
`min-h-screen` — it now fills exactly the space left over after the nav,
confirmed via `document.documentElement.scrollHeight === window.innerHeight`
in a real browser, not just eyeballed. Pages with no explicit height
(Payments, Attendance, ...) are unaffected — flex only sizes children that
opt into `flex-1`.

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
row too (Payments' own reject only ever sees pending ones). Walk-in
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
registration, Raffle, Attendance, Scanner, Payments — and confirmed
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

**The ticket email carries the QR itself, and there's a button to send the
backlog** (2026-09-08). Confirmation emails have been failing since sales
opened — `RESEND_FROM_EMAIL` is still `onboarding@resend.dev`, which drops
mail to everyone but the account owner (`docs/setup/resend.md`) — so a
growing set of approved payees hold a paid ticket nobody has ever emailed
them. Two changes, both aimed at the moment the domain lands:
- `registrations.ticket_email_sent_at` (`0009`) records what actually went
  out, the same "null is the queue" shape as `evaluation_invited_at`. The
  Dashboard's **Ticket emails** card sends to everyone still null, oldest
  first, in batches of 100, stamping a batch only after Resend accepts it —
  so pressing it again retries exactly what failed. A per-row **Email QR** /
  **Resend QR** action covers the individual "it went to spam" case, and is
  deliberately *not* gated on the stamp.
- The approval email now shows the QR, not just a link to it, via a new
  public `GET /ticket/<id>/qr` PNG route (approved-and-coded only). An
  attachment would have been the obvious choice and is the wrong one:
  Resend's batch endpoint rejects attachments, and batching is the only way
  600 students get emailed inside one request. The link stays under the
  image for clients that block remote content.

The bulk send **refuses to run while `RESEND_FROM_EMAIL` ends in
`@resend.dev`** (`sendingDomainReady()`). That guard is the load-bearing
part: on the placeholder sender Resend can accept a batch call and discard
the mail afterwards, which would stamp hundreds of rows as emailed and bury
the very backlog the button exists to clear. Pending students were left out
of the backfill by choice — they get their email automatically on approval.

### 4.8 Post-event evaluation and certificate of attendance

Added 2026-09-05 at QA's request — the first piece of scope that lives
entirely *after* the party, and the only one whose audience is students who
already came.

The flow: an admin presses **Send invites** on `/admin/evaluations` after the
event; everyone scanned in at the door gets an email with a link to
`/evaluate/<registration id>`; submitting the evaluation unlocks their
certificate at `/certificate/<registration id>`, viewable on screen,
downloadable as a PNG or a PDF, and emailed to them with the PDF attached. The
certificate carries a QR pointing at `/verify/<ticket code>`, a public page
that confirms the serial belongs to a real attendee and shows nothing else.

The decisions worth not relitigating:
- **Only students with an `ok` door scan may evaluate.** The certificate
  asserts attendance, so it can't be issued off a registration alone. Someone
  the scanner missed on the night gets sorted out by an organiser, not by
  loosening the gate.
- **The certificate is locked behind the evaluation**, which is the point QA
  raised — the certificate is what makes anyone open the email.
- **Responses are linked to the registration, but admin sees aggregate.**
  The link is what rejects a duplicate and gates the certificate;
  `/admin/evaluations` shows totals and lists the written answers without
  names.
- **The questions are the organisers' form (`v1`, 2026-09-17), minus its
  repeats.** Anything the paper form asked twice is kept once, in its first
  place; ratings are required, written answers and the tick-all list are not.
- **Questions and artwork both stay easy to swap.** The
  questionnaire is `src/lib/evaluation/questions.ts` and the certificate art
  is a drop-in `public/certificate-bg.png`; changing either touches nothing
  else. Answers are stored as jsonb stamped with a `form_version`, so
  rewording the questions needs no migration.

### 4.9 Faculty invitation and the faculty giveaway

Added 2026-09-20 at the adviser's request. Faculty never buy a ticket and are
never scanned at the door, so they had no row in `registrations` and no way
into the raffle pool at all.

The flow: one shared QR goes out with the invitation; scanning it opens the
letter at `/invitation`; ticking "I have read this" and giving a name is the
entry. `/admin/faculty` is the adviser's list. On the night,
`/admin/raffle?audience=faculty` draws from it, with its own winner history.

The decisions worth not relitigating, all confirmed explicitly:
- **One shared QR, not one per person.** No roster to prepare and one image to
  send anywhere, at the cost of a real open door: anyone with the QR can
  submit any name. The guards are a unique index on the normalized name (one
  entry per name, enforced by the database), a cookie so a repeat scan skips
  the form, and Remove on the admin list. Deliberately **no rate limit** — a
  room full of faculty scanning at one meeting is the expected case, and a
  burst cap would lock them out.
- **The cost of that choice: there is no "hasn't opened it yet" list.** The
  app never learns who the QR was sent to, so the adviser gets who came
  forward plus a headcount, not a tick-off against a faculty directory. That
  would need the per-person QR design, and the roster up front.
- **No attendance gate.** Acknowledging is the whole entry, so a faculty
  member who never turns up can still win and the emcee redraws on the spot.
  The opposite of the student rule, on purpose.
- **Students and faculty are separate pools, histories and exclusion sets**,
  keyed on `raffle_draws.audience`. This also fixes a bug that would
  otherwise have been found on stage — see `context/SCHEMA.md`.
- **The letter is content-as-code** (`src/lib/faculty/letter.ts`), the same
  swappable shape as `src/lib/evaluation/questions.ts`. Its body is a
  **PLACEHOLDER** until the organisers supply the real text; `LETTER_VERSION`
  is stamped on every acknowledgement so a later rewording doesn't rewrite
  what anyone agreed to.

### 4.10 Self-service ticket lookup, an inline QR, and delivery confirmation

Added 2026-09-22, driven by a growing pattern of "I never got my QR" /
"the QR won't show in Gmail" complaints that were reaching the group chat
one student at a time. The three fixes target three different failure
points rather than one bigger email pipeline:

- **`/find`** (`src/app/find/`) — a student who has no working email at all
  (never sent, sent to a mistyped address, buried) reaches their ticket with
  just their student ID and the email they registered with, both required
  and checked together. One generic "no match" message either way, so a
  classmate's student ID alone (visible on their own ID) can't be used to
  probe for someone else's ticket. Linked from the landing page footer, the
  ticket page, and — once approved — the approval and backlog emails
  themselves. `findOwnRegistration()` prefers the active registration, and
  falls back to the most recent rejected one so a rejected student can still
  see the reason and resubmit.
- **A "Save QR to phone" button** on the ticket page, and `?download=1` on
  `/ticket/[id]/qr` to back it — a real file save rather than a long-press,
  which not every phone offers the same way on an inline image.
- **The QR is now a `cid:` inline attachment on every single send**
  (approval, resend, walk-in — see `sendTicketApprovedEmail` in
  `src/lib/notify/email.ts`), not just a hosted `<img>`. "The QR is blank in
  Gmail" traced back to Gmail's own image proxy stalling on the remote fetch;
  an attachment needs no fetch. The bulk backlog send is unaffected — Resend's
  batch endpoint refuses attachments outright, so it keeps the hosted URL,
  which is exactly what `/find` and the Save button now cover.
- **`ticket_email_delivered_at`** (`0019_ticket_email_delivered.sql`) closes
  the other half of the "QR sent" trust gap the 2026-09-19 bounce incident
  found (`docs/setup/resend.md` §5): "accepted by Resend" and "delivered to
  the mailbox" are different
  moments, and only the second is what a student's complaint is actually
  about. Set by the webhook's `email.delivered` event, tagged `kind=ticket`
  so a partial-payment or evaluation email never marks it. The Dashboard now
  shows **QR not sent** / **QR sent, not confirmed** / **QR delivered** (or
  **Email bounced**, unchanged) per row, plus a **QR sent, not confirmed**
  filter — the group a bounce filter alone can't surface. Requires ticking
  `email.delivered` on the existing Resend webhook endpoint, `docs/setup/resend.md` §6.
  **Still can't confirm inbox vs. spam** — Resend's own limit, which is why
  `/find` and Save QR exist as the zero-email-required fallback rather than
  chasing delivery confirmation further.

**Same-day follow-up: a typo'd checkout email locks a student out of `/find`
too**, since it needs an exact match on both fields. Two additions, both
2026-09-22:
- **"Request a fix" on `/find`'s no-match screen** — student ID, name, and
  the correct email. Two guards on the requested address, matching
  checkout/walk-in/edit exactly: the same MX/mail-server reachability check
  (`emailDomainProblem`), so a "fixed" address that still can't receive mail
  doesn't just bounce again, and a 3-per-15-minutes throttle per student ID,
  reusing the existing submission-throttle constants. Never changes the
  address itself — anyone could claim any student ID, so a human still
  verifies and edits it by hand on the Dashboard, same as every other review
  step in this app.
- **`/admin/email-fixes`** (`0020_email_correction_requests.sql`) — the
  queue that request lands in, open by default with a Resolved history tab.
  Admin-only, matching `editRegistration` (the Dashboard action that
  actually performs the fix), which staff's route allowlist already can't
  reach — a queue whose fix step staff can't get to would be confusing, not
  convenient. Confirmed live against production data the same day: a real
  request (Arron John Iway, one of the three students flagged bounced back
  on 2026-09-19 — see `docs/setup/resend.md` §5) came in with a mistyped
  student ID, which is exactly why its `registration_id` match came back
  null — not a bug, just the student typo'ing their own ID on the way to
  reporting a typo'd email. The row still links to a name search on the
  Dashboard for that case.

### 4.11 The online payment line is closed (2026-09-24)

The instructor announced payments are shut for good: the 2026-09-19
deadline had been extended, and with the event a week out the caterer
needs the final count — no further payments or participants can be
accommodated. Closing it is a switch, not a redeploy: a `settings` row
(`payments_open`, migration `0021`, seeded closed) flipped live from the
Dashboard's **Online payments** toggle (`togglePaymentsOpen`,
`requireAdmin()`, logged as `online_payments_toggled`).

Closed means: `/checkout` renders a closed panel instead of the GCash
instructions and form; `submitRegistration` rejects **before** the receipt
upload, so a stale open tab leaves no orphaned file; the landing page's
two CTAs become an outline "Payments are closed" and the "Three steps"
section disappears; a rejected ticket's "Submit again" link becomes
"contact an organiser". Everything reads the flag fresh (`force-dynamic`),
so the flip takes effect on the next request.

Deliberately unchanged: walk-in cash sales, bulk import, and partial
balances — the flag gates the public GCash path only — and existing
registrations; pending online submissions stay on the Payments queue for
admins to approve or reject by hand. The flag fails closed: a missing row
or a failed read renders as closed, never open.

## 5. Explicitly out of scope
Refunds, ticket transfers, waitlists, seat assignment, multiple ticket tiers,
group purchasing, discount codes, a native mobile app. All addable later
without a schema rewrite, none needed for this event.

## 6. Key constraints that shape every decision
- **600+ attendees, ~5 weeks runway to 2026-10-03** (revised 2026-08-31 from
  an original under-two-weeks assumption, date corrected 2026-09-06 from
  2026-10-05 — see §1, §3). The build order still
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
