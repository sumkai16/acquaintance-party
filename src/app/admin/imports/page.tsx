import Link from "next/link";
import { listImportBatches } from "@/lib/import-batches/queries";
import { formatDateTimePH } from "@/lib/format/datetime";
import { Badge } from "../badge";
import { Table, Th, Tr } from "../table";

export const metadata = { title: "Imports" };
export const dynamic = "force-dynamic";

export default async function ImportsPage() {
  const batches = await listImportBatches();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl uppercase">Walk-in imports</h1>
      <p className="mt-1 text-ground/70">
        Every bulk import from the Walk-in page, by anyone. Download the file that was
        uploaded, or void a whole import at once if it was the wrong one.
      </p>

      <div className="mt-8">
        <Table empty={batches.length === 0 ? "No imports yet." : undefined}>
          <thead>
            <tr className="text-left">
              <Th>When</Th>
              <Th>Imported by</Th>
              <Th>File</Th>
              <Th>Tickets</Th>
              <Th>Status</Th>
              <Th> </Th>
            </tr>
          </thead>
          <tbody>
            {batches.map((batch) => (
              <Tr key={batch.id}>
                <td className="py-2 pr-3 pl-4 whitespace-nowrap">
                  {formatDateTimePH(batch.created_at)}
                </td>
                <td className="py-2 pr-3">{batch.uploadedByName}</td>
                <td className="py-2 pr-3">
                  <a
                    href={`/admin/imports/file/${batch.id}`}
                    className="font-medium text-accent-2 underline break-all"
                  >
                    {batch.file_name}
                  </a>
                </td>
                <td className="py-2 pr-3 tabular-nums whitespace-nowrap">
                  {batch.activeCount} active / {batch.created_count}
                  {batch.failed_count > 0 ? (
                    <span className="block text-xs text-ground/50">
                      {batch.failed_count} row{batch.failed_count === 1 ? "" : "s"} failed
                    </span>
                  ) : null}
                </td>
                <td className="py-2 pr-3">
                  {batch.voided_at || batch.activeCount === 0 ? (
                    <Badge tone="red">Voided</Badge>
                  ) : batch.activeCount < batch.created_count ? (
                    <Badge tone="amber">Partly voided</Badge>
                  ) : (
                    <Badge tone="green">Active</Badge>
                  )}
                </td>
                <td className="py-2 pr-3 last:pl-3">
                  <Link
                    href={`/admin/imports/${batch.id}`}
                    className="text-sm font-semibold text-accent-2 underline"
                  >
                    View
                  </Link>
                </td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>
    </main>
  );
}
