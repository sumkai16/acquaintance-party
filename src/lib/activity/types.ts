/**
 * Every kind of event the system writes to activity_logs. Adding a new kind
 * of loggable action means adding it here first — logActivity() takes only
 * these, so a typo can't silently create an unfiltered, unlabeled row.
 */
export const ACTIVITY_TYPES = [
  "login",
  "logout",
  "walk_in_payment_added",
  "walk_in_partial_payment_added",
  "walk_in_balance_paid",
  "payment_approved",
  "payment_rejected",
  "registration_voided",
  "registration_edited",
  "import_voided",
  "remittance_submitted",
  "remittance_approved",
  "remittance_rejected",
  "expense_added",
  "expense_voided",
  "email_failed",
  "ticket_email_sent",
  "receipt_failed",
  "email_correction_requested",
  "help_requested",
  "help_replied",
  "online_payments_toggled",
  "partial_qr_issued",
  "voting_toggled",
  "votes_revealed",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

const LABELS: Record<ActivityType, string> = {
  login: "Login",
  logout: "Logout",
  walk_in_payment_added: "Walk-in Payment Added",
  walk_in_partial_payment_added: "Walk-in Partial Payment",
  walk_in_balance_paid: "Walk-in Balance Paid",
  payment_approved: "Payment Approved",
  payment_rejected: "Payment Rejected",
  registration_voided: "Registration Voided",
  registration_edited: "Registration Edited",
  import_voided: "Import Voided",
  remittance_submitted: "Remittance Submitted",
  remittance_approved: "Remittance Approved",
  remittance_rejected: "Remittance Rejected",
  expense_added: "Expense Added",
  expense_voided: "Expense Voided",
  email_failed: "Email Failed",
  ticket_email_sent: "Ticket Email Sent",
  receipt_failed: "Receipt Not Issued",
  email_correction_requested: "Email Correction Requested",
  help_requested: "Help Requested",
  help_replied: "Help Request Answered",
  online_payments_toggled: "Online Payments Toggled",
  partial_qr_issued: "QR Sent Before Balance Paid",
  voting_toggled: "Crowd's Choice Voting Toggled",
  votes_revealed: "Crowd's Choice Result Revealed",
};

export function describeActivity(type: ActivityType): string {
  return LABELS[type];
}
