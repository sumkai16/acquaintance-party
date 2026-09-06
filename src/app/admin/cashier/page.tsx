import { redirect } from "next/navigation";
import { formatPeso } from "@/lib/config/event";
import { currentProfile } from "@/lib/supabase/server";
import { staffCashSummary } from "@/lib/cash/queries";
import { listStaffRemittances } from "@/lib/remittances/queries";
import { formatDateTimePH } from "@/lib/format/datetime";
import { Stat } from "../stat";
import { RemitButton } from "./remit-button";

export const metadata = { title: "My Dashboard" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  pending: "PENDING ADMIN APPROVAL",
  approved: "APPROVED",
  rejected: "REJECTED",
};

export default async function CashierDashboardPage() {
  const profile = await currentProfile();
  if (!profile) redirect("/admin/login");

  const [summary, remittances] = await Promise.all([
    staffCashSummary(profile.id),
    listStaffRemittances(profile.id),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl uppercase">Hi, {profile.fullName}</h1>
      <p className="mt-1 text-ground/70">Your walk-in collections and remittances.</p>

      <dl className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total collected" value={formatPeso(summary.currentCollectionCentavos)} />
        <Stat label="Pending remittance" value={formatPeso(summary.pendingRemittanceCentavos)} />
        <Stat label="Total transactions" value={summary.transactionCount} />
        <Stat label="Today's collection" value={formatPeso(summary.todayCollectionCentavos)} />
      </dl>

      <div className="mt-6">
        <RemitButton availableCentavos={summary.availableToRemitCentavos} />
      </div>

      {remittances.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ground/70">
            Your remittances
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {remittances.map((remittance) => (
              <li
                key={remittance.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ground/10 bg-ground/5 px-4 py-3"
              >
                <span className="font-bold tabular-nums">{formatPeso(remittance.amount)}</span>
                <span className="text-sm text-ground/60">
                  {formatDateTimePH(remittance.submitted_at)}
                </span>
                <span className="text-sm font-medium">
                  {STATUS_LABEL[remittance.status]}
                  {remittance.status === "rejected" && remittance.rejection_reason
                    ? ` — ${remittance.rejection_reason}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
