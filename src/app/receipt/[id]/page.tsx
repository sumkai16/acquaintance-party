import { notFound } from "next/navigation";
import { EVENT, formatPeso } from "@/lib/config/event";
import { formatReceiptNumber, paymentMethodLabel } from "@/lib/receipts/format";
import { getReceipt } from "@/lib/receipts/queries";
import { formatTicketCode } from "@/lib/tickets/code";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";
export const metadata = { title: `Receipt · ${EVENT.name}` };

/**
 * One payment's acknowledgement receipt. Reached by an unguessable id, same as
 * the ticket page. Printing uses the browser's own "Save as PDF", so there's
 * no PDF to generate and nothing extra to host.
 */
export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const receipt = await getReceipt(id);
  if (!receipt) notFound();

  const partial = receipt.balanceAfter > 0;
  const voided = receipt.registrationStatus === "rejected";
  const paidAt = receipt.paidAt.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 px-5 py-12 print:min-h-0 print:py-0">
      <article className="relative w-full overflow-hidden rounded-lg bg-white text-ink shadow-sm print:shadow-none">
        <header className="px-8 pt-8 pb-6">
          <p className="text-xs uppercase tracking-[0.3em] text-ink/60">{EVENT.host}</p>
          <h1 className="mt-2 font-display text-4xl uppercase leading-none">
            Acknowledgement receipt
          </h1>
          <p className="mt-3 text-sm text-ink/70">
            Not an official (BIR-registered) receipt — proof of payment for {EVENT.name} only.
          </p>
          {voided ? (
            <p className="mt-4 inline-block rounded border-2 border-red-700 px-3 py-1 font-display text-xl uppercase text-red-700">
              Voided
            </p>
          ) : null}
        </header>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-t border-ink/10 px-8 py-6">
          <Item label="Receipt no.">{formatReceiptNumber(receipt.number, receipt.paidAt)}</Item>
          <Item label="Date paid">{paidAt}</Item>

          <Item label="Received from" wide>
            {receipt.fullName}
            <span className="mt-0.5 block text-sm font-normal text-ink/60">
              {receipt.studentId} · {receipt.yearLevel} · Section {receipt.section}
            </span>
          </Item>

          <Item label="For" wide>
            {EVENT.name} ticket{partial ? " — partial payment" : ""}
          </Item>

          <Item label="Amount">{formatPeso(receipt.amount)}</Item>
          <Item label="Payment method">{paymentMethodLabel(receipt.method)}</Item>

          {partial ? (
            <Item label="Balance remaining" wide>
              {formatPeso(receipt.balanceAfter)}
            </Item>
          ) : null}

          <Item label="Received / verified by">{receipt.receivedByName ?? "An organiser"}</Item>
          <Item label="Ticket code">
            {receipt.ticketCode ? (
              <span className="font-mono">{formatTicketCode(receipt.ticketCode)}</span>
            ) : (
              <span className="text-ink/60">Issued once paid in full</span>
            )}
          </Item>
        </dl>
      </article>

      <PrintButton />
    </main>
  );
}

function Item({
  label,
  wide = false,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <dt className="text-xs uppercase tracking-wide text-ink/60">{label}</dt>
      <dd className="mt-1 font-semibold">{children}</dd>
    </div>
  );
}
