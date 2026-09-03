"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { EVENT } from "@/lib/config/event";
import { checkoutSchema } from "@/lib/registrations/schema";
import { isThrottled, throttleWindowStart } from "@/lib/registrations/abuse";
import {
  countRecentByEmail,
  createRegistration,
} from "@/lib/registrations/queries";
import { adminClient } from "@/lib/supabase/admin";
import { notifyNewRegistration } from "@/lib/notify/discord";
import { sendTicketSubmittedEmail } from "@/lib/notify/email";

export type SubmittedValues = {
  fullName: string;
  studentId: string;
  yearLevel: string;
  section: string;
  email: string;
  gcashReference: string;
};

export type FormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
  /**
   * What the student typed, echoed back on every non-redirect return.
   *
   * React resets every uncontrolled field in a <form action={fn}> once the
   * action finishes without navigating away — not just the field that was
   * wrong. Without this, a duplicate reference or a throttle hit wipes the
   * name/email/section the student already got right, and it looks like the
   * form silently ate their submission. `attempt` forces the inputs to
   * remount with these values via `key` — see checkout-form.tsx.
   */
  values?: SubmittedValues;
  attempt: number;
};

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const ALLOWED_RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp"];

function readValues(formData: FormData): SubmittedValues {
  return {
    fullName: String(formData.get("fullName") ?? ""),
    studentId: String(formData.get("studentId") ?? ""),
    yearLevel: String(formData.get("yearLevel") ?? ""),
    section: String(formData.get("section") ?? ""),
    email: String(formData.get("email") ?? ""),
    gcashReference: String(formData.get("gcashReference") ?? ""),
  };
}

export async function submitRegistration(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = readValues(formData);
  const attempt = _prev.attempt + 1;

  const parsed = checkoutSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0]);
      fieldErrors[field] ??= issue.message;
    }
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors,
      values,
      attempt,
    };
  }

  const recent = await countRecentByEmail(
    parsed.data.email,
    throttleWindowStart(new Date()),
  );
  if (isThrottled(recent)) {
    return {
      status: "error",
      message:
        "You have submitted several times in the last few minutes. " +
        "Wait a moment before trying again, or message an organiser for help.",
      values,
      attempt,
    };
  }

  const receipt = formData.get("receipt");
  if (!(receipt instanceof File) || receipt.size === 0) {
    return {
      status: "error",
      message: "Attach a screenshot of your GCash receipt.",
      fieldErrors: { receipt: "Attach your receipt screenshot." },
      values,
      attempt,
    };
  }
  if (receipt.size > MAX_RECEIPT_BYTES) {
    return {
      status: "error",
      message: "That image is over 5 MB. Try a screenshot instead of a photo.",
      fieldErrors: { receipt: "Keep the image under 5 MB." },
      values,
      attempt,
    };
  }
  if (!ALLOWED_RECEIPT_TYPES.includes(receipt.type)) {
    return {
      status: "error",
      message: "Upload a JPG, PNG, or WebP image.",
      fieldErrors: { receipt: "Use a JPG, PNG, or WebP image." },
      values,
      attempt,
    };
  }

  const extension = receipt.type.split("/")[1].replace("jpeg", "jpg");
  const receiptPath = `${new Date().getFullYear()}/${randomUUID()}.${extension}`;

  const upload = await adminClient()
    .storage.from("receipts")
    .upload(receiptPath, receipt, { contentType: receipt.type, upsert: false });

  if (upload.error) {
    console.error("receipt upload failed", upload.error);
    return {
      status: "error",
      message: "We could not save your receipt. Try again in a moment.",
      values,
      attempt,
    };
  }

  const created = await createRegistration({
    ...parsed.data,
    receiptPath,
    amount: EVENT.ticketPriceCentavos,
  });

  if (!created.ok) {
    // The receipt is now orphaned in storage. Remove it so a retry is clean.
    await adminClient().storage.from("receipts").remove([receiptPath]);

    if (created.error === "duplicate_reference") {
      return {
        status: "error",
        message:
          "That GCash reference number has already been used for another " +
          "ticket. Check that you copied the number from your own receipt.",
        fieldErrors: { gcashReference: "Already used for another ticket." },
        values,
        attempt,
      };
    }
    if (created.error === "duplicate_student_id") {
      return {
        status: "error",
        message:
          "You've already submitted a registration with this student ID. " +
          "If it was rejected, you can submit again — otherwise contact an " +
          "organiser.",
        fieldErrors: { studentId: "Already has an active registration." },
        values,
        attempt,
      };
    }
    return {
      status: "error",
      message: "Something went wrong saving your ticket. Try again in a moment.",
      values,
      attempt,
    };
  }

  // Scheduled with after(), not awaited directly: redirect() below ends the
  // response, and a plain fire-and-forget fetch can be killed mid-flight on
  // Vercel's serverless runtime once the response is sent. after() runs it
  // once the response has gone out and is guaranteed to complete.
  after(() =>
    Promise.all([
      notifyNewRegistration({
        fullName: parsed.data.fullName,
        yearLevel: parsed.data.yearLevel,
        section: parsed.data.section,
        amountCentavos: EVENT.ticketPriceCentavos,
        gcashReference: parsed.data.gcashReference,
      }),
      // The email field's whole stated purpose is finding this ticket again
      // if the link is lost — this is the only copy of it that reaches the
      // student outside the tab they're sitting in right now.
      sendTicketSubmittedEmail({
        to: parsed.data.email,
        fullName: parsed.data.fullName,
        ticketId: created.id,
      }),
    ]),
  );

  redirect(`/ticket/${created.id}`);
}
