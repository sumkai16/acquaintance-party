import type { ActivityType } from "@/lib/activity/types";

export type RegistrationStatus = "pending" | "approved" | "rejected";
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
  status: RegistrationStatus;
  reject_reason: string | null;
  ticket_code: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  evaluation_invited_at: string | null;
};

export type Evaluation = {
  id: string;
  registration_id: string;
  form_version: string;
  answers: Record<string, number | string | null>;
  submitted_at: string;
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
