"use client";

import { useState } from "react";
import { AddExpense } from "./add-expense";
import { ImportPanel } from "./import-panel";

const buttonClass =
  "rounded px-4 py-2.5 text-sm font-semibold uppercase tracking-wide focus:outline-2 focus:outline-offset-2 focus:outline-accent-2";

/** Add / Import / Export in one row; at most one of the two panels is open at a time. */
export function ExpenseActions({
  remainingCashCentavos,
  remainingGcashCentavos,
}: {
  remainingCashCentavos: number;
  remainingGcashCentavos: number;
}) {
  const [panel, setPanel] = useState<"add" | "import" | null>(null);
  const close = () => setPanel(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPanel(panel === "add" ? null : "add")}
          className={`${buttonClass} bg-accent text-white`}
        >
          Add expense
        </button>
        <button
          type="button"
          onClick={() => setPanel(panel === "import" ? null : "import")}
          className={`${buttonClass} border border-ground/25 text-ground hover:border-ground/50`}
        >
          Import from Excel
        </button>
        {/* A plain link, not fetch: the route answers with a file download. */}
        <a
          href="/admin/expenses/export"
          className={`${buttonClass} border border-ground/25 text-ground hover:border-ground/50`}
        >
          Export .xlsx
        </a>
      </div>

      {panel === "add" ? <AddExpense onClose={close} /> : null}
      {panel === "import" ? (
        <ImportPanel
          remainingCashCentavos={remainingCashCentavos}
          remainingGcashCentavos={remainingGcashCentavos}
          onClose={close}
        />
      ) : null}
    </div>
  );
}
