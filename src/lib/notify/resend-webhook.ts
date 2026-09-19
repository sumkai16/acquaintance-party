import "server-only";
import type { EmailBouncedEvent } from "resend";
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
 * first place, so a bounce for it has nothing to undo.
 */
export async function handleEmailBounced(event: EmailBouncedEvent): Promise<void> {
  const registrationId = event.data.tags?.registration_id;
  const recipient = event.data.to[0] ?? "an address";

  if (!registrationId) {
    console.warn("Resend bounce with no registration_id tag", recipient);
    return;
  }

  const registration = await getRegistration(registrationId);
  await Promise.all([
    clearTicketEmailSent(registrationId),
    clearReceiptsEmailedFor(registrationId),
  ]);

  await logActivity({
    userId: null,
    activityType: "email_failed",
    description:
      `Email to ${recipient} bounced` +
      (registration ? ` for ${registration.full_name}` : "") +
      " — back in the send queue.",
    registrationId,
  });
}
