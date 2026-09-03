import { WalkInForm } from "./walk-in-form";

export const metadata = { title: "Walk-in" };

export default function WalkInPage() {
  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <header className="mb-6">
        <h1 className="font-display text-3xl uppercase">Walk-in sale</h1>
        <p className="text-ground/60">
          For a student paying cash in person, not through GCash.
        </p>
      </header>

      <WalkInForm />
    </main>
  );
}
