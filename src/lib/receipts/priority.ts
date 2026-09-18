/**
 * Who the Receipts backlog emails first. The daily email limit means the
 * backlog goes out over several days, so the order decides who waits:
 *
 * 1. `qr` — paid in full but never emailed their QR. They have no ticket in
 *    hand at all, so they're the ones who complain.
 * 2. `partial` — paid part in cash; the receipt is their only proof of it.
 * 3. `receipt` — already have their QR and only lack the receipt.
 */
export type BacklogGroup = "qr" | "partial" | "receipt";

const RANK: Record<BacklogGroup, number> = { qr: 0, partial: 1, receipt: 2 };

export function backlogGroup(registration: {
  status: string;
  ticket_email_sent_at: string | null;
}): BacklogGroup {
  if (registration.status === "partial") return "partial";
  return registration.ticket_email_sent_at ? "receipt" : "qr";
}

/**
 * Most urgent group first; within a group, the order they arrived in (oldest
 * payment first). Array.prototype.sort is stable, which is what keeps that
 * second part true.
 */
export function sortByPriority<T extends { group: BacklogGroup }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => RANK[a.group] - RANK[b.group]);
}
