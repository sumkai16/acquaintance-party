"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { EVENT } from "@/lib/config/event";
import { checkoutSchema } from "@/lib/registrations/schema";
import { createRegistration } from "@/lib/registrations/queries";
import { adminClient } from "@/lib/supabase/admin";

export type FormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const ALLOWED_RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function submitRegistration(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = checkoutSchema.safeParse({
    fullName: formData.get("fullName"),
    yearLevel: formData.get("yearLevel"),
    section: formData.get("section"),
    email: formData.get("email"),
    gcashReference: formData.get("gcashReference"),
  });

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
    };
  }

  const receipt = formData.get("receipt");
  if (!(receipt instanceof File) || receipt.size === 0) {
    return {
      status: "error",
      message: "Attach a screenshot of your GCash receipt.",
      fieldErrors: { receipt: "Attach your receipt screenshot." },
    };
  }
  if (receipt.size > MAX_RECEIPT_BYTES) {
    return {
      status: "error",
      message: "That image is over 5 MB. Try a screenshot instead of a photo.",
      fieldErrors: { receipt: "Keep the image under 5 MB." },
    };
  }
  if (!ALLOWED_RECEIPT_TYPES.includes(receipt.type)) {
    return {
      status: "error",
      message: "Upload a JPG, PNG, or WebP image.",
      fieldErrors: { receipt: "Use a JPG, PNG, or WebP image." },
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
      };
    }
    return {
      status: "error",
      message: "Something went wrong saving your ticket. Try again in a moment.",
    };
  }

  redirect(`/ticket/${created.id}`);
}
