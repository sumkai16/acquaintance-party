import Image from "next/image";
import Link from "next/link";
import { EVENT, formatPeso } from "@/lib/config/event";
import { CheckoutForm } from "./checkout-form";

export const metadata = { title: `Get your ticket · ${EVENT.name}` };

export default function CheckoutPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 md:py-16">
      <Link
        href="/"
        className="text-sm font-semibold uppercase tracking-wide text-ink/60 hover:text-ink"
      >
        ← {EVENT.name}
      </Link>

      <div className="mt-8 grid gap-12 md:grid-cols-2 md:gap-16">
        {/* Payment instructions come first: the student needs a reference
            number from GCash before the form can be filled in. */}
        <section>
          <p className="text-sm uppercase tracking-[0.2em] text-ink/60">
            Step 1
          </p>
          <h1 className="mt-2 font-display text-4xl uppercase md:text-5xl">
            Pay with GCash
          </h1>
          <p className="mt-3 max-w-prose">
            Send {formatPeso(EVENT.ticketPriceCentavos)} to the account below,
            then keep the receipt open — you will need the reference number.
          </p>

          <dl className="mt-6 rounded border border-ink/20 bg-white/60 p-5">
            <dt className="text-sm uppercase tracking-wide text-ink/60">
              Send to
            </dt>
            <dd className="font-display text-2xl">{EVENT.gcash.name}</dd>
            <dd className="font-mono text-lg">{EVENT.gcash.number}</dd>

            <dt className="mt-4 text-sm uppercase tracking-wide text-ink/60">
              Amount
            </dt>
            <dd className="font-display text-2xl">
              {formatPeso(EVENT.ticketPriceCentavos)}
            </dd>
          </dl>

          <Image
            src={EVENT.gcash.qrImage}
            alt={`GCash QR code for ${EVENT.gcash.name}`}
            width={240}
            height={240}
            className="mt-6 rounded bg-white p-3"
          />
        </section>

        <section>
          <p className="text-sm uppercase tracking-[0.2em] text-ink/60">
            Step 2
          </p>
          <h2 className="mt-2 mb-6 font-display text-4xl uppercase md:text-5xl">
            Your details
          </h2>
          <CheckoutForm />
        </section>
      </div>
    </main>
  );
}
