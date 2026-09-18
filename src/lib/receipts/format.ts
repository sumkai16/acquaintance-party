export type ReceiptMethod = "gcash" | "cash";

/** "AR-2026-0007" — the year the payment was made, in Manila time. */
export function formatReceiptNumber(number: number, paidAt: Date): string {
  const year = paidAt.toLocaleDateString("en-PH", { year: "numeric", timeZone: "Asia/Manila" });
  return `AR-${year}-${String(number).padStart(4, "0")}`;
}

export function paymentMethodLabel(method: ReceiptMethod): string {
  return method === "gcash" ? "GCash (online)" : "Cash (walk-in)";
}
