import {
  findByReference,
  listPending,
  signedReceiptUrl,
} from "@/lib/registrations/queries";
import { ReviewTable } from "./review-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payments" };

export default async function ReviewPage() {
  const pending = await listPending();

  const rows = await Promise.all(
    pending.map(async (registration) => ({
      registration,
      // Every pending row is an online submission (walk-ins are approved on
      // the spot, never pending) — the DB's payment_fields_match_method
      // check guarantees both are set, so it's safe to assert past the
      // nullable type here rather than in every other reader of Registration.
      receiptUrl: await signedReceiptUrl(registration.receipt_path!),
      duplicateCount: (await findByReference(registration.gcash_reference!))
        .length,
    })),
  );

  return (
    <main className="mx-auto w-full max-w-5xl p-6 2xl:max-w-7xl">
      <header>
        <h1 className="font-display text-3xl uppercase">Payments</h1>
        <p className="text-ground/60">
          {pending.length === 0
            ? "Nothing waiting. Every payment has been reviewed."
            : `${pending.length} waiting for review.`}
        </p>
      </header>

      <ReviewTable rows={rows} />
    </main>
  );
}
