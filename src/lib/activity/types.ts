/**
 * Every kind of event the system writes to activity_logs. Adding a new kind
 * of loggable action means adding it here first — logActivity() takes only
 * these, so a typo can't silently create an unfiltered, unlabeled row.
 */
export const ACTIVITY_TYPES = [
  "login",
  "logout",
  "walk_in_payment_added",
  "payment_approved",
  "payment_rejected",
  "registration_voided",
  "remittance_submitted",
  "remittance_approved",
  "remittance_rejected",
  "email_failed",
  "ticket_email_sent",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

const LABELS: Record<ActivityType, string> = {
  login: "Login",
  logout: "Logout",
  walk_in_payment_added: "Walk-in Payment Added",
  payment_approved: "Payment Approved",
  payment_rejected: "Payment Rejected",
  registration_voided: "Registration Voided",
  remittance_submitted: "Remittance Submitted",
  remittance_approved: "Remittance Approved",
  remittance_rejected: "Remittance Rejected",
  email_failed: "Email Failed",
  ticket_email_sent: "Ticket Email Sent",
};

export function describeActivity(type: ActivityType): string {
  return LABELS[type];
}
