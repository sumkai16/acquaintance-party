-- Repairs tickets created in the gap between pasting 0013/0014 and deploying
-- the code that uses them (2026-09-17 night to 2026-09-18 ~09:42 Manila).
-- The old code kept running live, knew nothing about amount_paid, and left
-- every ticket it created at the column default: 0 collected, no receipt.
-- Found as 31 approved rows. Safe to run more than once: both statements
-- only touch rows that still need it.

-- 1. An approved ticket is always paid in full — online approvals and full
--    walk-ins alike. Partial rows are status 'partial' and aren't touched.
update registrations
set amount_paid = amount
where status = 'approved'
  and amount_paid = 0;

-- 2. Issue the receipts those tickets never got, oldest payment first. Same
--    rules as the 0014 backfill; emailed_at stays null, so they join the
--    Dashboard's Receipts backlog like everyone else who's owed one.
insert into receipts (
  registration_id, full_name, student_id, year_level, section,
  amount, method, balance_after, received_by, paid_at
)
select
  r.id, r.full_name, r.student_id, r.year_level, r.section,
  r.amount_paid,
  case when r.payment_method = 'online' then 'gcash' else 'cash' end,
  r.amount - r.amount_paid,
  r.reviewed_by,
  case when r.payment_method = 'online' then r.created_at
       else coalesce(r.reviewed_at, r.created_at) end as paid_at
from registrations r
where r.status::text in ('approved', 'partial')
  and r.amount_paid > 0
  and not exists (select 1 from receipts x where x.registration_id = r.id)
order by paid_at;
