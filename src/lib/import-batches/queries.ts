import "server-only";
import { randomUUID } from "node:crypto";
import { adminClient } from "@/lib/supabase/admin";
import { listAllProfileNames } from "@/lib/profiles/queries";
import type { ImportBatch, RegistrationStatus } from "@/lib/supabase/types";

// Same private bucket as payment and expense receipts; imports/ keeps the
// files apart from both (<year>/… and expenses/…).
const BUCKET = "receipts";
const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Records the batch and stores the uploaded file *before* any ticket is
 * created. If the file can't be stored, the batch row is removed and the
 * import must not go ahead — an import nobody can audit later is the exact
 * problem this exists to prevent.
 */
export async function startImportBatch(
  uploadedBy: string,
  file: File,
): Promise<{ ok: true; id: string } | { ok: false }> {
  const id = randomUUID();
  const filePath = `imports/${id}.xlsx`;

  const { error: insertError } = await adminClient()
    .from("import_batches")
    .insert({ id, uploaded_by: uploadedBy, file_name: file.name, file_path: filePath });
  if (insertError) {
    console.error("startImportBatch: insert failed", insertError);
    return { ok: false };
  }

  const { error: uploadError } = await adminClient()
    .storage.from(BUCKET)
    .upload(filePath, file, { contentType: XLSX_TYPE, upsert: false });
  if (uploadError) {
    console.error("startImportBatch: upload failed", uploadError);
    await adminClient().from("import_batches").delete().eq("id", id);
    return { ok: false };
  }

  return { ok: true, id };
}

/**
 * Stamps the final counts. A batch that created nothing is deleted along
 * with its file — there are no tickets to audit or void.
 */
export async function finishImportBatch(
  id: string,
  createdCount: number,
  failedCount: number,
): Promise<void> {
  if (createdCount === 0) {
    const { data } = await adminClient()
      .from("import_batches")
      .delete()
      .eq("id", id)
      .select("file_path")
      .maybeSingle();
    if (data?.file_path) await adminClient().storage.from(BUCKET).remove([data.file_path]);
    return;
  }

  const { error } = await adminClient()
    .from("import_batches")
    .update({ created_count: createdCount, failed_count: failedCount })
    .eq("id", id);
  if (error) console.error("finishImportBatch failed", error);
}

export type ImportBatchSummary = ImportBatch & {
  uploadedByName: string;
  voidedByName: string | null;
  activeCount: number;
};

async function withNames(
  batches: ImportBatch[],
  activeCounts: Map<string, number>,
): Promise<ImportBatchSummary[]> {
  const names = await listAllProfileNames();
  return batches.map((batch) => ({
    ...batch,
    uploadedByName: names.get(batch.uploaded_by) ?? "Unknown",
    voidedByName: batch.voided_by ? (names.get(batch.voided_by) ?? "Unknown") : null,
    activeCount: activeCounts.get(batch.id) ?? 0,
  }));
}

/** Every batch, newest first, with how many of its tickets are still active. */
export async function listImportBatches(): Promise<ImportBatchSummary[]> {
  const [{ data: batches, error }, { data: active }] = await Promise.all([
    adminClient().from("import_batches").select("*").order("created_at", { ascending: false }),
    adminClient()
      .from("registrations")
      .select("import_batch_id")
      .not("import_batch_id", "is", null)
      .neq("status", "rejected"),
  ]);
  if (error) throw new Error(`listImportBatches failed: ${error.message}`);

  const counts = new Map<string, number>();
  for (const row of active ?? []) {
    const id = row.import_batch_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return withNames((batches as ImportBatch[]) ?? [], counts);
}

export type ImportedTicket = {
  id: string;
  full_name: string;
  student_id: string;
  year_level: string;
  section: string;
  status: RegistrationStatus;
  reject_reason: string | null;
};

export async function getImportBatch(
  id: string,
): Promise<{ batch: ImportBatchSummary; tickets: ImportedTicket[] } | null> {
  const [{ data: batch }, { data: tickets, error }] = await Promise.all([
    adminClient().from("import_batches").select("*").eq("id", id).maybeSingle(),
    adminClient()
      .from("registrations")
      .select("id, full_name, student_id, year_level, section, status, reject_reason")
      .eq("import_batch_id", id)
      .order("full_name"),
  ]);
  if (!batch) return null;
  if (error) throw new Error(`getImportBatch failed: ${error.message}`);

  const rows = (tickets as ImportedTicket[]) ?? [];
  const active = rows.filter((row) => row.status !== "rejected").length;
  const [summary] = await withNames([batch as ImportBatch], new Map([[id, active]]));
  return { batch: summary, tickets: rows };
}

/** A 10-minute signed URL that downloads the original file under its original name. */
export async function signedImportFileUrl(batchId: string): Promise<string | null> {
  const { data: batch } = await adminClient()
    .from("import_batches")
    .select("file_path, file_name")
    .eq("id", batchId)
    .maybeSingle();
  if (!batch) return null;

  const { data } = await adminClient()
    .storage.from(BUCKET)
    .createSignedUrl(batch.file_path, 600, { download: batch.file_name });
  return data?.signedUrl ?? null;
}

export type VoidedTicket = { id: string; full_name: string; student_id: string; amount: number };

export type VoidBatchResult =
  | { ok: true; voided: VoidedTicket[]; batch: ImportBatch }
  | { ok: false; error: "not_found" | "already_voided" | "failed" };

/**
 * Voids every still-active ticket from the batch in one UPDATE — the same
 * change voidRegistration (src/app/admin/dashboard/actions.ts) makes to a
 * single row. `.neq("status", "rejected")` in the same statement means a
 * ticket already voided individually is left alone, and a second press of
 * the button finds nothing to change.
 */
export async function voidImportBatch(
  batchId: string,
  adminId: string,
  reason: string,
): Promise<VoidBatchResult> {
  const { data: batch } = await adminClient()
    .from("import_batches")
    .select("*")
    .eq("id", batchId)
    .maybeSingle();
  if (!batch) return { ok: false, error: "not_found" };

  const now = new Date().toISOString();
  const { data, error } = await adminClient()
    .from("registrations")
    .update({
      status: "rejected",
      reject_reason: reason,
      ticket_code: null,
      reviewed_at: now,
      reviewed_by: adminId,
    })
    .eq("import_batch_id", batchId)
    .neq("status", "rejected")
    .select("id, full_name, student_id, amount");

  if (error) {
    console.error("voidImportBatch failed", error);
    return { ok: false, error: "failed" };
  }

  const voided = (data as VoidedTicket[]) ?? [];
  if (voided.length === 0) return { ok: false, error: "already_voided" };

  // Only the first void stamps the batch; a later one (after a re-approval
  // elsewhere, say) keeps the original record of who voided it and why.
  const { error: stampError } = await adminClient()
    .from("import_batches")
    .update({ voided_at: now, voided_by: adminId, void_reason: reason })
    .eq("id", batchId)
    .is("voided_at", null);
  if (stampError) console.error("voidImportBatch: stamping batch failed", stampError);

  return { ok: true, voided, batch: batch as ImportBatch };
}
