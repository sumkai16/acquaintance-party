import { EVENT } from "@/lib/config/event";

/**
 * Whether a staff-entered amount is a valid partial payment: at least the
 * flat floor (`EVENT.partialPaymentMinCentavos`), and strictly less than the
 * full price — equal or more is a full sale, not a partial one, and belongs
 * on the regular walk-in path instead. Pure so it can be unit tested without
 * pulling in `server-only` — see RULES.md.
 */
export function isValidPartialAmount(
  paidCentavos: number,
  fullAmountCentavos: number,
): boolean {
  return (
    paidCentavos >= EVENT.partialPaymentMinCentavos && paidCentavos < fullAmountCentavos
  );
}
