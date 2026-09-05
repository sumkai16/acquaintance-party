-- Post-event evaluation and certificate of attendance.
--
-- Students who were actually scanned in at the door fill in an evaluation
-- after the party; submitting it unlocks their certificate. Eligibility is
-- derived from `scans` (result = 'ok'), never stored as a flag — the same
-- rule the raffle and the attendance dashboard already use.

create table evaluations (
  id uuid primary key default gen_random_uuid(),

  -- Unique, not just a foreign key: this constraint *is* the
  -- one-submission-per-attendee rule. A double-submit races to the database
  -- and loses there, which no client-side guard can promise.
  registration_id uuid not null unique
    references registrations (id) on delete cascade,

  -- Which draft of the question set produced these answers. The questions
  -- themselves live in src/lib/evaluation/questions.ts; stamping the version
  -- keeps old responses readable after the wording changes.
  form_version text not null,

  -- Answers keyed by question id. jsonb rather than a column per question so
  -- the draft questions can change without another migration.
  answers jsonb not null,

  submitted_at timestamptz not null default now()
);

-- Whether the invite email has gone out, so re-running the send picks up only
-- who is left — including attendees whose door scan synced late.
alter table registrations add column evaluation_invited_at timestamptz;

alter table evaluations enable row level security;

-- Read-only for signed-in admins, matching registrations and scans. Every
-- write goes through a server action on the service-role key: the attendee
-- filling this in is anonymous, and anon holds no policy on any table.
create policy "admins read evaluations" on evaluations
  for select to authenticated using (true);
