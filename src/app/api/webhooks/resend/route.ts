import { Resend } from "resend";
import { resendAccount, resendWebhookSecrets } from "@/lib/notify/resend-account";
import { handleEmailBounced } from "@/lib/notify/resend-webhook";

/**
 * Resend calls this the moment a send it already accepted turns out not to
 * have landed. No admin session exists to gate this on — Resend is the
 * caller, not a browser — so the signature check *is* the auth. See
 * docs/setup/resend.md for the one-time dashboard step that makes this
 * endpoint receive anything at all.
 */
export async function POST(request: Request) {
  const webhookSecrets = resendWebhookSecrets();
  // Verifying a signature never calls the API, so any configured key will do.
  const apiKey = resendAccount().apiKey ?? process.env.RESEND_API_KEY;
  if (webhookSecrets.length === 0 || !apiKey) {
    console.error("Resend webhook called but RESEND_WEBHOOK_SECRET or RESEND_API_KEY is unset");
    return Response.json({ error: "Not configured" }, { status: 500 });
  }

  const payload = await request.text();
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return Response.json({ error: "Missing signature headers" }, { status: 401 });
  }

  // Each Resend account signs with its own secret; accept whichever matches.
  const resend = new Resend(apiKey);
  let event;
  for (const webhookSecret of webhookSecrets) {
    try {
      event = resend.webhooks.verify({
        payload,
        headers: { id: svixId, timestamp: svixTimestamp, signature: svixSignature },
        webhookSecret,
      });
      break;
    } catch {
      // Try the next account's secret.
    }
  }
  if (!event) {
    console.error("Resend webhook signature check failed against every configured secret");
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event.type === "email.bounced") {
    await handleEmailBounced(event);
  }

  return Response.json({ ok: true });
}
