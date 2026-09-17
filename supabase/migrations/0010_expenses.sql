-- Admin-recorded event expenses. Deducted from the event's cash/GCash
-- totals only on the Expenses page itself — no other table changes, so
-- Cash, Dashboard, and Attendance numbers are untouched by this feature.
--
-- Same access model as every prior migration: authenticated gets SELECT,
-- but there is no INSERT/UPDATE policy for any role. Every write goes
-- through the service-role client from a server action — see
-- context/RULES.md.

create type expense_method as enum ('cash', 'gcash');

create table expenses (
  id         uuid primary key default gen_random_uuid(),
  item_name  text not null check (length(trim(item_name)) between 2 and 120),
  amount     integer not null check (amount > 0), -- centavos, never a float
  method     expense_method not null,
  spent_at   timestamptz not null, -- when the money was actually spent; admin-editable
  added_by   uuid not null references auth.users (id),
  created_at timestamptz not null default now(),

  -- Voided, never deleted — an expense entered by mistake still shows in
  -- the audit trail, same reasoning as registrations and remittances.
  voided_at   timestamptz,
  voided_by   uuid references auth.users (id),
  void_reason text,

  constraint void_fields_consistent check (
    (voided_at is null and voided_by is null and void_reason is null)
    or (
      voided_at is not null
      and voided_by is not null
      and length(trim(coalesce(void_reason, ''))) > 0
    )
  )
);

create index expenses_spent_idx on expenses (spent_at desc);

alter table expenses enable row level security;

create policy "authenticated read expenses" on expenses
  for select to authenticated using (true);
