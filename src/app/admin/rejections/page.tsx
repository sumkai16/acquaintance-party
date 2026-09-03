import { listAdminEmails, listRejected } from "@/lib/registrations/queries";
// Reused as-is from Find a registration — it already renders the "Rejected
// by <email> on <date> — <reason>" line this page exists to make browsable
// without first knowing who to search for.
import { RegistrationRow } from "../registrations/registration-row";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rejections" };

export default async function RejectionsPage() {
  const rejected = await listRejected();
  // Only needed to label each row with who rejected it — skip the lookup
  // when there's nothing to show.
  const adminEmails = rejected.length > 0 ? await listAdminEmails() : new Map<string, string>();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-5 px-5 py-10">
      <header>
        <h1 className="font-display text-3xl uppercase">Rejections</h1>
        <p className="text-ground/60">
          {rejected.length === 0
            ? "Nothing has been rejected."
            : `${rejected.length} rejected registration${rejected.length === 1 ? "" : "s"}, most recent first.`}
        </p>
      </header>

      <ul className="flex flex-col gap-3">
        {rejected.map((registration) => (
          <RegistrationRow
            key={registration.id}
            registration={registration}
            reviewerEmail={
              registration.reviewed_by
                ? (adminEmails.get(registration.reviewed_by) ?? null)
                : null
            }
          />
        ))}
      </ul>
    </main>
  );
}
