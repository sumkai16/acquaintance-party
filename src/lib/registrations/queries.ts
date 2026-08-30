import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import type { Registration } from "@/lib/supabase/types";
import type { CheckoutInput } from "./schema";

/** Postgres unique-violation SQLSTATE. */
const UNIQUE_VIOLATION = "23505";

export type CreateResult =
  | { ok: true; id: string }
  | { ok: false; error: "duplicate_reference" | "failed" };

export async function createRegistration(
  input: CheckoutInput & { receiptPath: string; amount: number },
): Promise<CreateResult> {
  const { data, error } = await adminClient()
    .from("registrations")
    .insert({
      full_name: input.fullName,
      year_level: input.yearLevel,
      section: input.section,
      email: input.email,
      gcash_reference: input.gcashReference,
      receipt_path: input.receiptPath,
      amount: input.amount,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { ok: false, error: "duplicate_reference" };
    }
    console.error("createRegistration failed", error);
    return { ok: false, error: "failed" };
  }

  return { ok: true, id: data.id };
}

export async function getRegistration(id: string): Promise<Registration | null> {
  const { data } = await adminClient()
    .from("registrations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  return (data as Registration) ?? null;
}

export async function listPending(): Promise<Registration[]> {
  const { data } = await adminClient()
    .from("registrations")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  return (data as Registration[]) ?? [];
}

/** Every registration sharing a GCash reference. Used to flag reused receipts. */
export async function findByReference(
  reference: string,
): Promise<Registration[]> {
  const { data } = await adminClient()
    .from("registrations")
    .select("*")
    .eq("gcash_reference", reference)
    .order("created_at", { ascending: true });

  return (data as Registration[]) ?? [];
}

/**
 * A short-lived URL for a receipt image. The bucket is private, so this is the
 * only way an admin sees the file, and the link dies in ten minutes.
 */
export async function signedReceiptUrl(path: string): Promise<string | null> {
  const { data } = await adminClient()
    .storage.from("receipts")
    .createSignedUrl(path, 600);

  return data?.signedUrl ?? null;
}
