-- One row per "my email is wrong" request submitted from /find, and the
-- admin queue that replaces the activity_logs-only version of this feature
-- (0019's era) — activity_logs.description is free text a "resolved" state
-- can't attach to, and staff had no dedicated place to work through these.
--
-- registration_id is resolved by student_id alone at submit time, best
-- effort — null is common (a typo in the student's own ID is exactly why
-- they're here), not an error. `on delete set null` so voiding or deleting
-- the registration this pointed at never blocks touching the request row.
create table email_correction_requests (
  id               uuid primary key default gen_random_uuid(),
  student_id       text not null,
  full_name        text not null,
  requested_email  text not null,
  registration_id  uuid references registrations (id) on delete set null,
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz,
  resolved_by      uuid references auth.users (id)
);

-- Backs the open-queue listing (unresolved, newest first) and the throttle
-- (recent rows for one student_id) — see countRecentEmailFixRequests.
create index email_correction_requests_open_idx
  on email_correction_requests (created_at desc) where resolved_at is null;
create index email_correction_requests_student_id_idx
  on email_correction_requests (student_id, created_at desc);

alter table email_correction_requests enable row level security;
create policy "authenticated read email_correction_requests" on email_correction_requests
  for select to authenticated using (true);
