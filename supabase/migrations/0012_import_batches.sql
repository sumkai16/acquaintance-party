-- One row per confirmed Walk-in bulk import, and a link from every ticket it
-- created back to it. Lets an admin see exactly what file a staff member
-- uploaded, and void every ticket from a wrong file in one step instead of
-- one by one.
--
-- Same access model as every prior migration: authenticated gets SELECT, no
-- INSERT/UPDATE policy for any role — writes go through the service-role
-- client from server actions. See context/RULES.md.

create table import_batches (
  id            uuid primary key default gen_random_uuid(),
  uploaded_by   uuid not null references auth.users (id),
  file_name     text not null,
  -- Key in the private `receipts` bucket, under imports/. Not a URL.
  file_path     text not null,
  created_count integer not null default 0,
  failed_count  integer not null default 0,
  created_at    timestamptz not null default now(),

  voided_at   timestamptz,
  voided_by   uuid references auth.users (id),
  void_reason text,

  constraint batch_void_fields_consistent check (
    (voided_at is null and voided_by is null and void_reason is null)
    or (
      voided_at is not null
      and voided_by is not null
      and length(trim(coalesce(void_reason, ''))) > 0
    )
  )
);

create index import_batches_created_idx on import_batches (created_at desc);

-- Tickets outlive their batch record if one is ever deleted by hand.
alter table registrations
  add column import_batch_id uuid references import_batches (id) on delete set null;

create index registrations_import_batch_idx on registrations (import_batch_id);

alter table import_batches enable row level security;

create policy "authenticated read import_batches" on import_batches
  for select to authenticated using (true);
