import "server-only";
import { after } from "next/server";
import { sendTicketApprovedEmail } from "@/lib/notify/email";
import { logActivity } from "@/lib/activity/queries";

/**
 * Fires the same-instant ticket email a walk-in sale always sends, logging
 * `email_failed` if Resend rejects or can't reach it — shared by the
 * one-at-a-time form (actions.ts) and the bulk import's confirm step
 * (import-actions.ts), which both need the exact same after-response
 * behavior per registration.
 *
 * Deliberately not in actions.ts or import-actions.ts: both are "use
 * server" files, where Next.js treats every export as a client-callable
 * server action and requires it to be async — this helper isn't meant to
 * be called from the client at all, just shared server-side, so it lives
 * in its own plain module instead.
 */
export function scheduleWalkInTicketEmail(
  adminId: string,
  ticket: { to: string; fullName: string; ticketId: string },
) {
  after(async () => {
    const status = await sendTicketApprovedEmail(ticket);
    if (status === "failed") {
      await logActivity({
        userId: adminId,
        activityType: "email_failed",
        description: `Walk-in ticket email to ${ticket.to} failed to send for ${ticket.fullName}`,
        registrationId: ticket.ticketId,
      });
    }
  });
}
