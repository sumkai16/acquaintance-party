import { BulkImportProvider, BulkImportToggle, WalkInLayout } from "./bulk-import";
import { WalkInForm } from "./walk-in-form";

export const metadata = { title: "Walk-in" };

export default function WalkInPage() {
  return (
    // Wider than the single-entry form needs on its own, so the bulk-import
    // review table has room to sit beside it — WalkInLayout centers the
    // form within this instead when the panel is closed.
    <main className="mx-auto max-w-6xl px-5 py-10">
      <BulkImportProvider>
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl uppercase">Walk-in sale</h1>
            <p className="text-ground/60">
              For a student paying cash in person, not through GCash.
            </p>
          </div>
          <BulkImportToggle />
        </header>

        <WalkInLayout>
          <WalkInForm />
        </WalkInLayout>
      </BulkImportProvider>
    </main>
  );
}
