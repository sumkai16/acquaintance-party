/**
 * "Total Collected" on the staff dashboard — stays at the full collected
 * amount while a remittance covering it is only pending, and drops only
 * once Admin actually approves it. The pending amount must not silently
 * zero the card before Admin has acted.
 */
export function currentCollectionCentavos(
  collectedCentavos: number,
  approvedRemittedCentavos: number,
): number {
  return Math.max(0, collectedCentavos - approvedRemittedCentavos);
}

/**
 * What a staff member is actually allowed to remit right now — unlike
 * currentCollectionCentavos, this DOES subtract what's already pending, so
 * the same cash can't be submitted in two remittances at once. The "Total
 * Collected" card and the Remit button's limit are deliberately different
 * numbers for this reason.
 */
export function availableToRemitCentavos(
  currentCollectionCentavos: number,
  pendingRemittedCentavos: number,
): number {
  return Math.max(0, currentCollectionCentavos - pendingRemittedCentavos);
}
