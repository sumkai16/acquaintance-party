export type RegistrationStatus = "pending" | "approved" | "rejected";
export type ScanResult = "ok" | "duplicate" | "invalid";

export type Registration = {
  id: string;
  full_name: string;
  year_level: string;
  section: string;
  email: string;
  gcash_reference: string;
  receipt_path: string;
  amount: number;
  status: RegistrationStatus;
  reject_reason: string | null;
  ticket_code: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};
