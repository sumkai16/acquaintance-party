import { formatPeso } from "@/lib/config/event";
import { formatDateTimePH } from "@/lib/format/datetime";
import { totalCashCollectedCentavos } from "@/lib/cash/queries";
import { onlinePaymentsSummary } from "@/lib/registrations/queries";
import { listExpenses, spentCentavos } from "@/lib/expenses/queries";
import { expenseBalances } from "@/lib/expenses/parse";
import { Stat } from "../stat";
import { Table, Th, Tr } from "../table";
import { ExpenseActions } from "./expense-actions";
import { ReceiptButton } from "./receipt-button";
import { VoidExpense } from "./void-expense";

export const metadata = { title: "Expenses" };
export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const [cashCollected, gcashCollected, spent, expenses] = await Promise.all([
    totalCashCollectedCentavos(),
    onlinePaymentsSummary(),
    spentCentavos(),
    listExpenses(),
  ]);

  const balances = expenseBalances({
    cashCollectedCentavos: cashCollected,
    gcashCollectedCentavos: gcashCollected.totalCentavos,
    cashSpentCentavos: spent.cashCentavos,
    gcashSpentCentavos: spent.gcashCentavos,
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl uppercase">Expenses</h1>
      <p className="mt-1 text-ground/70">
        Money spent on the event, deducted here only — Cash, Dashboard, and
        Attendance totals are unaffected.
      </p>

      <dl className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Total Cash"
          value={formatPeso(balances.totalCashCentavos)}
          detail={`${formatPeso(cashCollected)} collected − ${formatPeso(spent.cashCentavos)} spent`}
          negative={balances.totalCashCentavos < 0}
        />
        <Stat
          label="Total GCash"
          value={formatPeso(balances.totalGcashCentavos)}
          detail={`${formatPeso(gcashCollected.totalCentavos)} collected − ${formatPeso(spent.gcashCentavos)} spent`}
          negative={balances.totalGcashCentavos < 0}
        />
        <Stat
          label="Total Amount"
          value={formatPeso(balances.totalAmountCentavos)}
          detail="Cash + GCash remaining"
          negative={balances.totalAmountCentavos < 0}
        />
        <Stat
          label="Total Expenses"
          value={formatPeso(balances.totalExpensesCentavos)}
          detail={`${formatPeso(spent.cashCentavos)} cash + ${formatPeso(spent.gcashCentavos)} GCash`}
        />
      </dl>

      <section className="mt-8">
        <ExpenseActions
          remainingCashCentavos={balances.totalCashCentavos}
          remainingGcashCentavos={balances.totalGcashCentavos}
        />
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ground/70">
          Expense log
        </h2>
        <div className="mt-3">
          <Table empty={expenses.length === 0 ? "No expenses recorded yet." : undefined}>
            <thead>
              <tr>
                <Th>Item</Th>
                <Th>Amount</Th>
                <Th>Method</Th>
                <Th>Date &amp; time</Th>
                <Th>Added by</Th>
                <Th>Receipt</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => {
                const voided = expense.voided_at !== null;
                return (
                  <Tr key={expense.id}>
                    <td className={`py-2 pr-3 pl-4 font-medium ${voided ? "text-ground/40 line-through" : ""}`}>
                      {expense.item_name}
                    </td>
                    <td className={`py-2 pr-3 tabular-nums ${voided ? "text-ground/40" : ""}`}>
                      {formatPeso(expense.amount)}
                    </td>
                    <td className={`py-2 pr-3 ${voided ? "text-ground/40" : ""}`}>
                      {expense.method === "cash" ? "Cash" : "GCash"}
                    </td>
                    <td className={`py-2 pr-3 ${voided ? "text-ground/40" : ""}`}>
                      {formatDateTimePH(expense.spent_at)}
                    </td>
                    <td className={`py-2 pr-3 ${voided ? "text-ground/40" : ""}`}>
                      {expense.addedByName}
                    </td>
                    <td className="py-2 pr-3">
                      {expense.receipt_path ? (
                        <ReceiptButton expenseId={expense.id} itemName={expense.item_name} />
                      ) : (
                        <span className="text-ground/40">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 last:pl-3">
                      {voided ? (
                        <span className="text-xs text-ground/50">
                          Voided by {expense.voidedByName} — {expense.void_reason}
                        </span>
                      ) : (
                        <VoidExpense id={expense.id} />
                      )}
                    </td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      </section>
    </main>
  );
}
