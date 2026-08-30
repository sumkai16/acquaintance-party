import {
  findByReference,
  listPending,
  signedReceiptUrl,
} from "@/lib/registrations/queries";
import { ReviewCard } from "./review-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review queue" };

export default async function ReviewPage() {
  const pending = await listPending();

  const cards = await Promise.all(
    pending.map(async (registration) => ({
      registration,
      receiptUrl: await signedReceiptUrl(registration.receipt_path),
      duplicateCount: (await findByReference(registration.gcash_reference))
        .length,
    })),
  );

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-5 px-5 py-10">
      <header>
        <h1 className="text-2xl font-semibold">Review queue</h1>
        <p className="text-slate-500">
          {pending.length === 0
            ? "Nothing waiting. Every payment has been reviewed."
            : `${pending.length} waiting for review.`}
        </p>
      </header>

      {cards.map((card) => (
        <ReviewCard key={card.registration.id} {...card} />
      ))}
    </main>
  );
}
