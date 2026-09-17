-- Optional receipt photo per expense. Stored in the existing private
-- `receipts` bucket under an `expenses/` prefix, so no new bucket or storage
-- policy is needed — only the service-role client can read or write it.
-- Nullable: a receipt is optional, and imported rows never have one.

alter table expenses add column receipt_path text;
