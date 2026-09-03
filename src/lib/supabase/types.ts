export type RegistrationStatus = "pending" | "approved" | "rejected";
export type PaymentMethod = "online" | "walk_in";
export type ScanResult = "ok" | "duplicate" | "invalid";

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
};
