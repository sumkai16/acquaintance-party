import { Resend } from "resend";
import { handleEmailBounced } from "@/lib/notify/resend-webhook";

/**
 * Resend calls this the moment a send it already accepted turns out not to
 * have landed. No admin session exists to gate this on — Resend is the
 * caller, not a browser — so the signature check *is* the auth. See
 * docs/setup/resend.md for the one-time dashboard step that makes this
 * endpoint receive anything at all.
 */
export async function POST(request: Request) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  const apiKey = process.env.RESEND_API_KEY;
  if (!webhookSecret || !apiKey) {
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

  let event;
  try {
    event = new Resend(apiKey).webhooks.verify({
      payload,
      headers: { id: svixId, timestamp: svixTimestamp, signature: svixSignature },
      webhookSecret,
    });
  } catch (error) {
    console.error("Resend webhook signature check failed", error);
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event.type === "email.bounced") {
    await handleEmailBounced(event);
  }

  return Response.json({ ok: true });
}
