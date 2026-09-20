import type { ActivityType } from "@/lib/activity/types";

export type RegistrationStatus = "pending" | "approved" | "rejected" | "partial";
/** The Payments page only ever reviews online submissions — a walk-in never lands in this queue. */
export type ReviewStatus = "pending" | "approved" | "rejected";
export type PaymentMethod = "online" | "walk_in";
export type ScanResult = "ok" | "duplicate" | "invalid";
export type UserRole = "admin" | "staff";
export type RemittanceStatus = "pending" | "approved" | "rejected";

export type Registration = {
  id: string;
  full_name: string;
  student_id: string;
  year_level: string;
  section: string;
  email: string;
  payment_method: PaymentMethod;
  gcash_reference: string | null;
  receipt_path: string | null;
  amount: number;
  amount_paid: number;
  status: RegistrationStatus;
  reject_reason: string | null;
  ticket_code: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  evaluation_invited_at: string | null;
  ticket_email_sent_at: string | null;
  import_batch_id: string | null;
};

export type ImportBatch = {
  id: string;
  uploaded_by: string;
  file_name: string;
  file_path: string;
  created_count: number;
  failed_count: number;
  created_at: string;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
};

export type Evaluation = {
  id: string;
  registration_id: string;
  form_version: string;
  answers: Record<string, number | string | string[] | null>;
  submitted_at: string;
};

/**
 * One faculty member's acknowledgement of the letter at /invitation, which is
 * also their entry in the faculty giveaway. No email: the QR is shared, so
 * there is nothing to send anyone back.
 */
export type FacultyInvitation = {
  id: string;
  full_name: string;
  department: string | null;
  letter_version: string;
  acknowledged_at: string;
  created_at: string;
};

export type Profile = {
  id: string;
  fullName: string;
  role: UserRole;
};

export type CashRemittance = {
  id: string;
  staff_id: string;
  amount: number;
  status: RemittanceStatus;
  submitted_at: string;
  approved_at: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
};

export type ActivityLog = {
  id: string;
  user_id: string | null;
  activity_type: ActivityType;
  description: string;
  registration_id: string | null;
  remittance_id: string | null;
  amount: number | null;
  created_at: string;
};

export type ExpenseMethod = "cash" | "gcash";

export type Expense = {
  id: string;
  item_name: string;
  amount: number;
  method: ExpenseMethod;
  spent_at: string;
  added_by: string;
  created_at: string;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  receipt_path: string | null;
};
