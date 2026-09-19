import "server-only";
import type {
  EmailBouncedEvent,
  EmailComplainedEvent,
  EmailFailedEvent,
  EmailSuppressedEvent,
} from "resend";
import { clearTicketEmailSent, getRegistration } from "@/lib/registrations/queries";
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
 * A bounce, a suppression or a send failure means the student never got the
 * email, so they go back in the queue. A spam complaint means they did get it
 * and didn't want it: that is logged but never re-queued, because sending it
 * again is exactly what they objected to.
 */
export async function handleEmailUndelivered(event: UndeliveredEvent): Promise<void> {
  const registrationId = event.data.tags?.registration_id;
  const recipient = event.data.to[0] ?? "an address";

  if (!registrationId) {
    console.warn(`Resend ${event.type} with no registration_id tag`, recipient);
    return;
  }

  const registration = await getRegistration(registrationId);
  const requeue = event.type !== "email.complained";
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
      (requeue ? " — back in the send queue." : " — not re-sent."),
    registrationId,
  });
}
