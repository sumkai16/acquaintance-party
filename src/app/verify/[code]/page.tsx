import { EVENT } from "@/lib/config/event";
import { certificateFor } from "@/lib/certificates/data";
import { findByTicketCode } from "@/lib/evaluation/queries";
import { formatTicketCode, normalizeScannedCode } from "@/lib/tickets/code";

export const dynamic = "force-dynamic";
export const metadata = { title: `Verify a certificate · ${EVENT.name}` };

/**
 * Where a certificate's QR lands. Answers one question — is this serial a real
 * attendee's — and nothing more: no email, no student ID, no payment details,
 * because anyone holding a photo of the certificate can open this page.
 */
export default async function VerifyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const serial = normalizeScannedCode(decodeURIComponent(code));
  const registration = await findByTicketCode(serial);
  const certificate = registration
    ? await certificateFor(registration.id)
    : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-5 py-12">
      <div className="overflow-hidden rounded-lg bg-white shadow-sm">
        <header className="bg-accent px-5 py-4 text-center text-ground">
          <span className="font-display text-2xl uppercase leading-none">
            {EVENT.name}
          </span>
        </header>

        {certificate ? (
          <div className="p-6 text-center">
            <p className="font-display text-2xl uppercase text-accent">
              Verified
            </p>
            <p className="mt-4 text-lg font-bold">{certificate.fullName}</p>
            <p className="text-sm uppercase tracking-wide text-ink/70">
              {certificate.yearLevel} · Section {certificate.section}
            </p>
            <p className="mt-4 text-sm text-ink/70">
              Attended {EVENT.name} on{" "}
              {EVENT.startsAt.toLocaleDateString("en-PH", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              .
            </p>
            <p className="mt-4 font-mono text-sm tracking-widest text-ink/50">
              {formatTicketCode(certificate.serial)}
            </p>
          </div>
        ) : (
          <div className="p-6 text-center">
            <p className="font-display text-2xl uppercase text-ink/70">
              Not a certificate we issued
            </p>
            <p className="mt-3 text-sm text-ink/70">
              Nothing matches this serial. Check it was typed correctly, or ask
              the holder to open the link on their certificate.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
