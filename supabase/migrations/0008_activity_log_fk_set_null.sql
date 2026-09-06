-- activity_logs.registration_id / remittance_id had no ON DELETE action,
-- which defaults to RESTRICT — deleting a registration (or a remittance)
-- that has any activity log entry fails with a foreign key violation.
-- That's backwards: the log row is the append-only audit record and must
-- survive the thing it references being cleaned up (a voided test
-- registration, a corrected remittance). The FK should just go null, not
-- block the delete.

alter table activity_logs
  drop constraint activity_logs_registration_id_fkey,
  add constraint activity_logs_registration_id_fkey
    foreign key (registration_id) references registrations (id) on delete set null;

alter table activity_logs
  drop constraint activity_logs_remittance_id_fkey,
  add constraint activity_logs_remittance_id_fkey
    foreign key (remittance_id) references cash_remittances (id) on delete set null;
