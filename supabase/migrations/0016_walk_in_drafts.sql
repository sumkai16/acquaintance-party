-- The half-typed Walk-in "Type a list" sheet, one per staff member, so a
-- paper sign-in sheet can be started on one phone and finished on another.
-- Until now the draft lived only in that phone's browser storage.
--
-- Brand-new table the running code never touches, so it is safe to paste
-- before the code that uses it ships (unlike a column the live code must
-- write — see the 2026-09-18 amount_paid incident).
--
-- Names, student IDs and emails are personal data, so unlike most tables
-- here there is deliberately NO policy for any role — not even an
-- authenticated SELECT. Everything goes through server actions holding the
-- service-role key, which bypasses RLS. See context/RULES.md.

create table walk_in_drafts (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  rows       jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table walk_in_drafts enable row level security;
