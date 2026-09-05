import { notFound } from "next/navigation";
import { EVENT } from "@/lib/config/event";
import { certificateFor } from "@/lib/certificates/data";

export const dynamic = "force-dynamic";
export const metadata = { title: `Your certificate · ${EVENT.name}` };

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Null covers every "no certificate here" case at once — unknown link,
  // never scanned in, evaluation not submitted yet.
  const certificate = await certificateFor(id);
  if (!certificate) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-5 py-12">
      <header className="text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-ink/60">
          {EVENT.host}
        </p>
        <h1 className="mt-2 font-display text-4xl uppercase text-accent sm:text-5xl">
          Your certificate
        </h1>
        <p className="mt-3 text-ink/70">
          Thanks for the evaluation, {certificate.fullName.split(" ")[0]}. Save
          a copy below — this page stays at the same link.
        </p>
      </header>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/certificate/${id}/image`}
        alt={`Certificate of attendance for ${certificate.fullName}`}
        className="w-full rounded-lg bg-white shadow-sm"
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <a
          href={`/certificate/${id}/image?download=1`}
          className="rounded-full bg-accent px-6 py-3.5 text-center font-semibold uppercase tracking-wide text-white transition-opacity hover:opacity-90 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
        >
          Download image
        </a>
        <a
          href={`/certificate/${id}/pdf`}
          className="rounded-full border border-ink/25 px-6 py-3.5 text-center font-semibold uppercase tracking-wide text-ink transition-colors hover:bg-ink/5 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
        >
          Download PDF
        </a>
      </div>

      <p className="text-center text-sm text-ink/60">
        We also emailed you a copy. {EVENT.contact}
      </p>
    </main>
  );
}
