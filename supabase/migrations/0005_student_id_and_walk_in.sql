-- Student ID + walk-in payments.
--
-- Checkout previously had no way to cap one student to one registration.
-- Email alone is not a real identity key — a student can use a new address
-- per submission — so student_id is required on every registration now,
-- online or walk-in.
--
-- payment_method separates a self-service GCash submission (has a reference
-- and a receipt, goes through review) from a walk-in cash sale an admin
-- enters directly (neither, approved on the spot since staff already has
-- the cash in hand).

alter table registrations
  add column student_id text,
  add column payment_method text not null default 'online';

-- Pre-launch test rows only — no real sales have happened yet. Runs once;
-- every row inserted after this migration supplies its own student_id.
update registrations
  set student_id = 'legacy-' || substr(id::text, 1, 8)
  where student_id is null;

alter table registrations
  alter column student_id set not null,
  add constraint student_id_not_blank check (length(trim(student_id)) > 0),
  add constraint payment_method_valid check (payment_method in ('online', 'walk_in')),
  alter column gcash_reference drop not null,
  alter column receipt_path drop not null,
  add constraint payment_fields_match_method check (
    (payment_method = 'online' and gcash_reference is not null and receipt_path is not null)
    or
    (payment_method = 'walk_in' and gcash_reference is null and receipt_path is null)
  );

-- The anti-spam lever: at most one non-rejected registration per student at
-- a time. A rejected row — whether rejected during normal review, or voided
-- by an admin specifically to free the slot back up — falls outside this
-- index, so both ways of reopening a student's slot fall out of this one
-- rule rather than needing separate bookkeeping.
create unique index registrations_student_id_active_key
  on registrations (student_id)
  where status <> 'rejected';

-- registrations_gcash_reference_key needs no change: Postgres treats every
-- NULL as distinct, so any number of walk-in rows coexist under it.
