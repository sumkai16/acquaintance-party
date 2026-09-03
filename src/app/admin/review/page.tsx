import {
  findByReference,
  listPending,
  signedReceiptUrl,
} from "@/lib/registrations/queries";
import { ReviewTable } from "./review-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review queue" };

export default async function ReviewPage() {
  const pending = await listPending();

  const rows = await Promise.all(
    pending.map(async (registration) => ({
      registration,
      receiptUrl: await signedReceiptUrl(registration.receipt_path),
      duplicateCount: (await findByReference(registration.gcash_reference))
        .length,
    })),
  );

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-5 px-5 py-10">
      <header>
        <h1 className="font-display text-3xl uppercase">Review queue</h1>
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
