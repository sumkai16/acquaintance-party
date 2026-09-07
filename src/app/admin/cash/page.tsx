import { formatPeso } from "@/lib/config/event";
import {
  adminCurrentCollectionCentavos,
  cashPaymentCount,
  pendingRemittancesCentavos,
  staffCashOnHandCentavos,
  totalCashCollectedCentavos,
} from "@/lib/cash/queries";
import { listAllRemittances } from "@/lib/remittances/queries";
import { formatDateTimePH } from "@/lib/format/datetime";
import { Stat } from "../stat";
import { Table, Th, Tr } from "../table";
import { RemittanceActions } from "./remittance-actions";

export const metadata = { title: "Cash" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export default async function CashPage() {
  const [
    totalCashCollection,
    cashPayments,
    adminCurrent,
    staffOnHand,
    pendingRemit,
    remittances,
  ] = await Promise.all([
    totalCashCollectedCentavos(),
    cashPaymentCount(),
    adminCurrentCollectionCentavos(),
    staffCashOnHandCentavos(),
    pendingRemittancesCentavos(),
    listAllRemittances(),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl uppercase">Cash Remittance Management</h1>
      <p className="mt-1 text-ground/70">
        Walk-in cash only — GCash never passes through anyone&rsquo;s hands, so
        it is left to Find a registration. Remitting moves money from Staff to
        Admin; it is never counted twice.
      </p>

      <dl className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Total cash collection" value={formatPeso(totalCashCollection)} />
        <Stat label="Admin current collection" value={formatPeso(adminCurrent)} />
        <Stat label="Staff cash on hand" value={formatPeso(staffOnHand)} />
        <Stat label="Pending remittances" value={formatPeso(pendingRemit)} />
        <Stat label="Total cash payments" value={cashPayments} />
      </dl>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ground/70">
          Remittances
        </h2>
        <div className="mt-3">
          <Table empty={remittances.length === 0 ? "No remittances yet." : undefined}>
            <thead>
              <tr>
                <Th>Staff</Th>
                <Th>Amount</Th>
                <Th>Submitted</Th>
                <Th>Status</Th>
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody>
              {remittances.map((remittance) => (
                <Tr key={remittance.id}>
                  <td className="py-2 pr-3 pl-4 font-medium">{remittance.staffName}</td>
                  <td className="py-2 pr-3 tabular-nums">{formatPeso(remittance.amount)}</td>
                  <td className="py-2 pr-3">{formatDateTimePH(remittance.submitted_at)}</td>
                  <td className="py-2 pr-3">
                    {STATUS_LABEL[remittance.status]}
                    {remittance.status === "rejected" && remittance.rejection_reason
                      ? ` — ${remittance.rejection_reason}`
                      : ""}
                  </td>
                  <td className="py-2 pr-3 last:pl-3">
                    {remittance.status === "pending" ? (
                      <RemittanceActions id={remittance.id} />
                    ) : (
                      "—"
                    )}
                  </td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      </section>
    </main>
  );
}
