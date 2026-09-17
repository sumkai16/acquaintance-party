import {
  countByReferences,
  listAdminEmails,
  listForReview,
  onlinePaymentsSummary,
  reviewStatusCounts,
  signedReceiptUrls,
} from "@/lib/registrations/queries";
import { formatPeso } from "@/lib/config/event";
import type { RegistrationStatus } from "@/lib/supabase/types";
import { Stat } from "../stat";
import { ReviewTable } from "./review-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payments" };

const STATUSES: RegistrationStatus[] = ["pending", "approved", "rejected"];

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: rawStatus } = await searchParams;
  // No status (or a hand-edited one) means Pending — the queue is what an
  // admin opens this page for.
  const status = STATUSES.includes(rawStatus as RegistrationStatus)
    ? (rawStatus as RegistrationStatus)
    : "pending";

  const [registrations, online, counts] = await Promise.all([
    listForReview(status),
    onlinePaymentsSummary(),
    reviewStatusCounts(),
  ]);

  // listForReview only returns online rows, and the DB's
  // payment_fields_match_method check guarantees every online row has both a
  // reference and a receipt — safe to assert past the nullable type here.
  const [receiptUrls, referenceCounts, adminEmails] = await Promise.all([
    signedReceiptUrls(registrations.map((r) => r.receipt_path!)),
    countByReferences(registrations.map((r) => r.gcash_reference!)),
    // Only decided rows show who decided them. listAdminEmails hits the
    // Supabase Auth admin API, the slowest call here, so the pending queue
    // skips it.
    status === "pending" ? new Map<string, string>() : listAdminEmails(),
  ]);

  const rows = registrations.map((registration) => ({
    registration,
    receiptUrl: receiptUrls.get(registration.receipt_path!) ?? null,
    duplicateCount: referenceCounts.get(registration.gcash_reference!) ?? 0,
    reviewerEmail: registration.reviewed_by
      ? (adminEmails.get(registration.reviewed_by) ?? null)
      : null,
  }));

  return (
    <main className="mx-auto w-full max-w-5xl p-6 2xl:max-w-7xl">
      <header>
        <h1 className="font-display text-3xl uppercase">Payments</h1>
        <p className="text-ground/60">
          {counts.pending === 0
            ? "Nothing waiting. Every payment has been reviewed."
            : `${counts.pending} waiting for review.`}
        </p>
      </header>

      <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Online payees" value={online.count} />
        <Stat label="Online amount (GCash)" value={formatPeso(online.totalCentavos)} />
        <Stat label="Pending" value={counts.pending} />
      </dl>

      <ReviewTable rows={rows} status={status} counts={counts} />
    </main>
  );
}
