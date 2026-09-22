-- When Resend confirmed the ticket QR email actually reached the mailbox
-- server, as opposed to ticket_email_sent_at (Resend merely accepted the
-- send) or email_bounced_at (Resend confirmed it did NOT arrive). A row
-- can sit sent-but-neither for a while — this only fills in once the
-- webhook's email.delivered event arrives. Cleared alongside
-- ticket_email_sent_at whenever a resend goes out, so a stale confirmation
-- from a previous address never survives a fix.
alter table registrations add column ticket_email_delivered_at timestamptz;
