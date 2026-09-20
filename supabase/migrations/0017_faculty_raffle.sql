-- The faculty invitation and the faculty giveaway.
--
-- Faculty never buy a ticket and are never scanned at the door, so they have
-- no row in `registrations` and no way into the raffle pool. One shared QR
-- goes out with the invitation; scanning it opens the letter at /invitation,
-- and ticking "I have read this" with a name is the entry.
--
-- Safe to paste before the code that uses it ships. `faculty_invitations` is
-- a brand-new table the running code never touches, and the `audience` column
-- below has a default, so today's recordDraw() — which does not set it —
-- keeps inserting valid rows. That is the opposite shape to the 2026-09-18
-- amount_paid incident, where live code had to write a column that did not
-- exist yet.
--
-- Names and departments are personal data, so like walk_in_drafts (0016)
-- there is deliberately NO policy for any role — not even an authenticated
-- SELECT. Everything goes through server actions holding the service-role
-- key, which bypasses RLS. See context/RULES.md.

create table faculty_invitations (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null,
  department      text,
  letter_version  text not null,
  acknowledged_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  constraint faculty_name_length
    check (char_length(btrim(full_name)) between 2 and 120)
);

-- This index IS the duplicate rule, not a check in app code. The QR is shared,
-- so the same person scanning twice — or someone submitting a name already on
-- the list — races here and loses with 23505, which recordAcknowledgement()
-- turns into "you are already on the list" rather than an error. Same shape as
-- the unique index behind saveEvaluation() in src/lib/evaluation/queries.ts.
create unique index faculty_invitations_name_key
  on faculty_invitations (lower(btrim(full_name)));

alter table faculty_invitations enable row level security;

-- Which pool a draw came from. Defaulted rather than backfilled: every draw
-- recorded before this migration was a student draw by definition, and the
-- default makes the existing insert in recordDraw() valid unchanged.
alter table raffle_draws
  add column audience text not null default 'student';

alter table raffle_draws
  add constraint audience_is_known check (audience in ('student', 'faculty'));

-- Serves the projector's per-audience history read — allDraws(audience).
create index raffle_draws_audience_idx on raffle_draws (audience, drawn_at);
