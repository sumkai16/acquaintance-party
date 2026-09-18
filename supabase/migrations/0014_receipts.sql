-- Acknowledgement receipts — one row per payment, not per registration, so a
-- partial walk-in gets one receipt for each payment it took. See
-- context/SCHEMA.md.

create table receipts (
  id uuid primary key default gen_random_uuid(),
  -- Identity, not a count: never reused, even after a void, and two
  -- payments landing at once can't draw the same number.
  number integer generated always as identity unique,
  registration_id uuid references registrations(id) on delete set null,
  -- Snapshotted at issue time, like raffle_draws.finalists: a receipt records
  -- what was issued, so a later name correction doesn't rewrite it.
  full_name text not null,
  student_id text not null,
  year_level text not null,
  section text not null,
  amount integer not null check (amount > 0),
  method text not null check (method in ('gcash', 'cash')),
  balance_after integer not null check (balance_after >= 0),
  received_by uuid references auth.users(id),
  paid_at timestamptz not null,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);

create index receipts_registration_idx on receipts (registration_id);
create index receipts_unemailed_idx on receipts (paid_at) where emailed_at is null;

alter table receipts enable row level security;
create policy "authenticated read receipts" on receipts
  for select to authenticated using (true);

-- Backfill every payment already taken, numbered in the order it was paid.
-- Online: paid when the GCash was sent (created_at). Walk-in: when staff
-- recorded it (reviewed_at). emailed_at stays null, so all of these show up
-- in the Dashboard's receipt backlog.
insert into receipts (
  registration_id, full_name, student_id, year_level, section,
  amount, method, balance_after, received_by, paid_at
)
select
  id, full_name, student_id, year_level, section,
  amount_paid,
  case when payment_method = 'online' then 'gcash' else 'cash' end,
  amount - amount_paid,
  reviewed_by,
  case when payment_method = 'online' then created_at
       else coalesce(reviewed_at, created_at) end as paid_at
from registrations
where status::text in ('approved', 'partial')
  and amount_paid > 0
order by paid_at;
