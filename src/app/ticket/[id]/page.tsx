import { notFound } from "next/navigation";
import { EVENT } from "@/lib/config/event";
import { getRegistration } from "@/lib/registrations/queries";
import { formatTicketCode } from "@/lib/tickets/code";
import { ticketQrDataUrl } from "@/lib/tickets/qr";

export const dynamic = "force-dynamic";
export const metadata = { title: `Your ticket · ${EVENT.name}` };

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const registration = await getRegistration(id);
  if (!registration) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-5 py-12">
      <div className="overflow-hidden rounded-lg bg-white shadow-sm">
        <header className="flex items-center justify-between gap-3 bg-accent px-5 py-4 text-ground">
          <span className="font-display text-2xl uppercase leading-none">
            {EVENT.name}
          </span>
          <span className="text-right text-[10px] uppercase tracking-widest">
            Admit one
            <br />
            {EVENT.startsAt.toLocaleDateString("en-PH", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </header>

        {registration.status === "approved" && registration.ticket_code ? (
          <ApprovedTicket code={registration.ticket_code} />
        ) : registration.status === "rejected" ? (
          <Rejected reason={registration.reject_reason} />
        ) : (
          <Pending />
        )}

        <div className="px-5 pb-5">
          <p className="text-lg font-bold">{registration.full_name}</p>
          <p className="text-sm uppercase tracking-wide text-ink/70">
            {registration.year_level} · Section {registration.section}
          </p>
        </div>
      </div>

      <p className="text-center text-sm text-ink/70">
        Bookmark this page — it is your ticket. Lost it? Ask an organiser to
        look you up by your email address.
      </p>
    </main>
  );
}

async function ApprovedTicket({ code }: { code: string }) {
  const qr = await ticketQrDataUrl(code);
  return (
    // The QR must sit on plain white. Do not theme this block — phone
    // cameras fail to focus on codes over tinted or textured grounds.
    <div className="m-5 flex flex-col items-center gap-3 rounded bg-white p-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr} alt="Your ticket QR code" width={160} height={160} />
      <p className="font-mono text-sm tracking-widest text-ink/70">
        {formatTicketCode(code)}
      </p>
    </div>
  );
}

function Pending() {
  return (
    <div className="m-5 rounded bg-amber-50 p-5 text-center">
      <p className="font-display text-2xl uppercase text-amber-900">
        Waiting for approval
      </p>
      <p className="mt-2 text-sm text-amber-900/80">
        We check every payment by hand, in the order it arrives. Come back to
        this page any time — it updates on its own, and we&apos;ll also email
        you once it&apos;s approved.
      </p>
    </div>
  );
}

function Rejected({ reason }: { reason: string | null }) {
  return (
    <div className="m-5 rounded bg-red-50 p-5 text-center">
      <p className="font-display text-2xl uppercase text-red-900">
        We could not approve this
      </p>
      <p className="mt-2 text-sm text-red-900/80">
        {reason ?? "Contact an organiser for help."}
      </p>
      <a href="/checkout" className="mt-3 inline-block font-semibold underline">
        Submit again
      </a>
    </div>
  );
}
