-- Runtime switches the admin can flip without a redeploy — currently one:
-- whether the online GCash payment line is open or closed.
--
-- A key/value table rather than a column on some other table because this
-- is app state, not event data; a second switch (say, walk-in sales) later
-- is one insert, not a migration.
--
-- Seeded CLOSED: deploying this code is how the payment line gets shut
-- (instructor's announcement, 2026-09-24). The Dashboard toggle flips the
-- row live; re-pasting this file must not clobber that flip, hence
-- on conflict do nothing.
--
-- RLS is on with NO policy for any role — same as walk_in_drafts and
-- faculty_invitations. Reads and writes go through server actions holding
-- the service-role key, which bypasses RLS. See context/RULES.md.
--
-- Paste BEFORE the code that reads it ships (docs/setup/supabase.md §6):
-- a missing table reads as closed either way (fail-closed in
-- src/lib/settings/open.ts), but the Dashboard toggle cannot write until
-- this exists.

create table if not exists settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table settings enable row level security;

insert into settings (key, value) values ('payments_open', 'false')
  on conflict (key) do nothing;
