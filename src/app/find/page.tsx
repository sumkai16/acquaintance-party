import Link from "next/link";
import { EVENT } from "@/lib/config/event";
import { FindForm } from "./find-form";

export const metadata = { title: `Find your ticket · ${EVENT.name}` };

export default function FindPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-12">
      <Link
        href="/"
        className="inline-block py-3 text-sm font-semibold uppercase tracking-wide text-ink/70 hover:text-ink"
      >
        ← {EVENT.name}
      </Link>

      <h1 className="mt-4 font-display text-4xl uppercase md:text-5xl">
        Find your ticket
      </h1>
      <p className="mt-3 max-w-prose text-ink/75">
        Enter the student ID and email you registered with, and we&apos;ll take
        you straight to your ticket — no email required.
      </p>

      <div className="mt-8">
        <FindForm />
      </div>
    </main>
  );
}
