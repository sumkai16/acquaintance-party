import Link from "next/link";
import { notFound } from "next/navigation";
import { getImportBatch } from "@/lib/import-batches/queries";
import { formatDateTimePH } from "@/lib/format/datetime";
import { Badge } from "../../badge";
import { Table, Th, Tr } from "../../table";
import { VoidImport } from "./void-import";

export const metadata = { title: "Import" };
export const dynamic = "force-dynamic";

// Bulk imports never create a `partial` row (see the Walk-in page's separate
// partial-payment flow) — these two entries exist only so TypeScript accepts
// indexing by the full RegistrationStatus union.
const STATUS_TONE = {
  approved: "green",
  pending: "amber",
  rejected: "red",
  partial: "amber",
} as const;
const STATUS_LABEL = {
  approved: "Approved",
  pending: "Pending",
  rejected: "Voided",
  partial: "Partial",
} as const;

export default async function ImportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await getImportBatch(id);
  if (!found) notFound();
  const { batch, tickets } = found;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link href="/admin/imports" className="text-sm text-ground/60 hover:text-ground">
        ← All imports
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl uppercase break-all">{batch.file_name}</h1>
          <p className="mt-1 text-ground/70">
            Imported by {batch.uploadedByName} on {formatDateTimePH(batch.created_at)}
          </p>
          <p className="text-ground/70">
            {batch.activeCount} of {batch.created_count} ticket
            {batch.created_count === 1 ? "" : "s"} still active
            {batch.failed_count > 0 ? ` · ${batch.failed_count} row(s) failed at import` : ""}
          </p>
          {batch.voided_at ? (
            <p className="mt-2 text-sm text-red-300">
              Voided by {batch.voidedByName} on {formatDateTimePH(batch.voided_at)} —{" "}
              {batch.void_reason}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/admin/imports/file/${batch.id}`}
            className="rounded-full border border-ground/25 px-4 py-2 text-sm font-semibold hover:border-ground/50"
          >
            Download file
          </a>
          {batch.activeCount > 0 ? (
            <VoidImport batchId={batch.id} fileName={batch.file_name} activeCount={batch.activeCount} />
          ) : null}
        </div>
      </div>

      <div className="mt-8">
        <Table empty={tickets.length === 0 ? "No tickets are linked to this import." : undefined}>
          <thead>
            <tr className="text-left">
              <Th>Name</Th>
              <Th>Student ID</Th>
              <Th>Year / section</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <Tr key={ticket.id}>
                <td className="py-2 pr-3 pl-4 font-medium">{ticket.full_name}</td>
                <td className="py-2 pr-3 font-mono">{ticket.student_id}</td>
                <td className="py-2 pr-3">
                  {ticket.year_level} · {ticket.section}
                </td>
                <td className="py-2 pr-3">
                  <Badge tone={STATUS_TONE[ticket.status]}>{STATUS_LABEL[ticket.status]}</Badge>
                  {ticket.status === "rejected" && ticket.reject_reason ? (
                    <span className="mt-1 block text-xs text-ground/50">{ticket.reject_reason}</span>
                  ) : null}
                </td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>
    </main>
  );
}
