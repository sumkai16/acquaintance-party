-- Lets a walk-in cash sale be recorded as partially paid — any admin-entered
-- amount, not a fixed split (see src/lib/registrations/partial.ts for the
-- minimum-percentage floor, which is an app-layer rule, not a DB one). No QR
-- goes out until the balance is settled — see context/SCHEMA.md.

alter type registration_status add value 'partial';

alter table registrations add column amount_paid integer not null default 0;

-- Backfill so every existing cash total (which is about to switch from
-- summing `amount` to summing `amount_paid`) reads identical to before this
-- migration for every row that already exists.
update registrations set amount_paid = amount where status = 'approved';

alter table registrations add constraint amount_paid_within_amount
  check (amount_paid >= 0 and amount_paid <= amount);

-- Written as status::text so it doesn't reference the 'partial' literal
-- through the enum type directly — keeps this safe to paste in the same run
-- as the ADD VALUE above, in case the SQL editor treats that as still
-- uncommitted for the rest of the script. Doesn't encode the minimum-percent
-- floor — that's validated in the app layer, same as the section-matches-
-- year-level rule — only that a partial row is genuinely underpaid.
alter table registrations add constraint partial_is_walk_in_underpaid
  check (
    status::text <> 'partial'
    or (payment_method = 'walk_in' and amount_paid > 0 and amount_paid < amount)
  );
