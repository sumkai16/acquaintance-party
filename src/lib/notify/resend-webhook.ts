import "server-only";
import type {
  EmailBouncedEvent,
  EmailComplainedEvent,
  EmailDeliveredEvent,
  EmailFailedEvent,
  EmailSuppressedEvent,
} from "resend";
import {
  clearTicketEmailSent,
  getRegistration,
  markEmailBounced,
  markTicketEmailDelivered,
} from "@/lib/registrations/queries";
import { clearReceiptsEmailedFor } from "@/lib/receipts/queries";
import { logActivity } from "@/lib/activity/queries";

/**
 * The gap this closes: markTicketEmailSent / markReceiptsEmailed stamp the
 * moment Resend *accepts* a send, not the moment it lands — a batch or
 * single send can be accepted and still bounce seconds later, and nothing
 * before this ever found out. Every send that carries a `registration_id`
 * tag (see src/lib/notify/email.ts) can be traced back here; anything else
 * — the checkout submission email, say — was never stamped "sent" in the
 * first place, so a send that fails for it has nothing to undo.
 */
type UndeliveredEvent =
  | EmailBouncedEvent
  | EmailSuppressedEvent
  | EmailFailedEvent
  | EmailComplainedEvent;

/** What the activity log says happened, in the words an admin would use. */
function describe(event: UndeliveredEvent): string {
  switch (event.type) {
    case "email.bounced":
      return "bounced";
    case "email.suppressed":
      return "was suppressed by Resend (the address is on its suppression list)";
    case "email.failed":
      return `failed to send (${event.data.failed.reason})`;
    case "email.complained":
      return "was reported as spam";
  }
}

/**
 * A bounce or a send failure means the student never got the email, so they
 * go back in the queue. Two cases are logged but never re-queued:
 * - A spam complaint: they got it and didn't want it, and sending it again is
 *   exactly what they objected to.
 * - A suppression: Resend will refuse that address every time, so re-queuing
 *   only makes "Send" report success and the same people bounce straight back.
 *   It needs a corrected address or a manual removal from Resend's list.
 */
export async function handleEmailUndelivered(event: UndeliveredEvent): Promise<void> {
  const registrationId = event.data.tags?.registration_id;
  const recipient = event.data.to[0] ?? "an address";

  if (!registrationId) {
    console.warn(`Resend ${event.type} with no registration_id tag`, recipient);
    return;
  }

  const registration = await getRegistration(registrationId);
  const requeue = event.type !== "email.complained" && event.type !== "email.suppressed";
  // A complaint means it arrived; every other event means it did not.
  if (event.type !== "email.complained") await markEmailBounced(registrationId);
  if (requeue) {
    await Promise.all([
      clearTicketEmailSent(registrationId),
      clearReceiptsEmailedFor(registrationId),
    ]);
  }

  await logActivity({
    userId: null,
    activityType: "email_failed",
    description:
      `Email to ${recipient} ${describe(event)}` +
      (registration ? ` for ${registration.full_name}` : "") +
      (requeue
        ? " — back in the send queue."
        : event.type === "email.suppressed"
          ? " — not re-queued, it would be refused again. Fix the address, or remove it from Resend's suppression list, then use “Resend QR email” on their row."
          : " — not re-sent."),
    registrationId,
  });
}

/**
 * Confirms a ticket QR email actually reached the mailbox server — the
 * Dashboard's answer to "did they actually get it?" that "accepted" alone
 * can't give. Only sends tagged `kind=ticket` reach here (see
 * src/lib/notify/email.ts): a partial-payment or evaluation-invite email
 * carries no QR, so its delivery isn't tracked on this column.
 */
export async function handleEmailDelivered(event: EmailDeliveredEvent): Promise<void> {
  const registrationId = event.data.tags?.registration_id;
  if (!registrationId || event.data.tags?.kind !== "ticket") return;

  await markTicketEmailDelivered(registrationId);
}
