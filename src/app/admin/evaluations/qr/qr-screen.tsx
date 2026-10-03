"use client";

import Link from "next/link";
import { useSetNavHidden } from "../../admin-nav";

/**
 * The evaluation QR full screen, for the projector. A white card with a quiet
 * zone around black modules is what a phone camera needs from the back of a
 * room (context/DESIGN.md §4), so it is never tinted.
 */
export function QrScreen({ qr, url }: { qr: string | null; url: string | null }) {
  useSetNavHidden(true);

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center gap-6 bg-deep px-8 py-10 text-center text-ground">
      <Link
        href="/admin/evaluations"
        className="absolute top-4 left-4 text-sm text-ground/25 hover:text-ground"
      >
        ← Back to evaluation
      </Link>

      <h1 className="font-display text-6xl uppercase text-white md:text-8xl">How was it?</h1>
      <p className="text-xl text-ground/80 md:text-3xl">
        Scan to evaluate the party and get your certificate
      </p>

      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element -- a data URL, nothing for next/image to optimise
        <img
          src={qr}
          alt={`QR code to evaluate the party, linking to ${url}`}
          className="w-[min(60vh,80vw)] rounded-2xl bg-white p-3"
        />
      ) : (
        <p className="max-w-prose text-ground/70">
          Set <code className="font-mono">NEXT_PUBLIC_SITE_URL</code> in Vercel and redeploy
          to show the QR. The page itself is at <code className="font-mono">/evaluate</code>.
        </p>
      )}

      {url ? <p className="font-mono text-lg text-ground/60 md:text-2xl">{url}</p> : null}
    </main>
  );
}
