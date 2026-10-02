-- Crowd's Choice: the students' vote at Battle of the Beats — one favourite
-- band and one favourite solo act per person, cast from /vote.
--
-- registration_id is UNIQUE: that index IS the one-vote-per-person rule, not
-- a check in app code. A double-tap, or a second try from another phone,
-- races here and loses with 23505, which castVote() reports as "already
-- voted" — a normal answer, never an error. Same shape as evaluations and
-- faculty_invitations.
--
-- The act keys (band_choice / solo_choice) are validated against
-- src/lib/config/battle.ts in the app, not by a constraint here: the line-up
-- is configuration, and changing it should not need a migration.
--
-- RLS is on with NO policy for any role — same as faculty_invitations and
-- settings. The voter is an unauthenticated student, so the write goes
-- through a server action on the service-role key, which bypasses RLS. See
-- context/RULES.md.
--
-- Three switches in `settings` (0021), all seeded CLOSED/hidden:
--   voting_open    — whether /vote accepts ballots
--   band_revealed  — whether the projector shows the band winner
--   solo_revealed  — whether the projector shows the solo winner
-- The two winners are revealed separately so the emcee can announce one, then
-- the other. on conflict do nothing, so re-pasting this file never clobbers a
-- switch an admin has already flipped. (An earlier draft of this file seeded a
-- single `votes_revealed` row; nothing reads it any more, so a database that
-- already has it needs no change.)
--
-- Paste BEFORE the code that reads it ships (docs/setup/supabase.md §6).

create table if not exists crowd_votes (
  id              uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references registrations(id) on delete cascade,
  band_choice     text not null,
  solo_choice     text not null,
  created_at      timestamptz not null default now()
);

alter table crowd_votes enable row level security;

insert into settings (key, value) values
  ('voting_open', 'false'),
  ('band_revealed', 'false'),
  ('solo_revealed', 'false')
  on conflict (key) do nothing;
