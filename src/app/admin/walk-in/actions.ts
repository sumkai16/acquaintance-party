"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { EVENT } from "@/lib/config/event";
import { walkInSchema } from "@/lib/registrations/schema";
import { createWalkInRegistration } from "@/lib/registrations/queries";
import { currentAdminId } from "@/lib/supabase/server";
import { sendTicketApprovedEmail } from "@/lib/notify/email";

export type SubmittedValues = {
  fullName: string;
  studentId: string;
  yearLevel: string;
  section: string;
  email: string;
};

export type FormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
  // Same reset-on-error problem as checkout's FormState.values — see the
  // comment there. Keying inputs on `attempt` keeps a typo from wiping the
  // rest of the form.
  values?: SubmittedValues;
  attempt: number;
};

function readValues(formData: FormData): SubmittedValues {
  return {
    fullName: String(formData.get("fullName") ?? ""),
    studentId: String(formData.get("studentId") ?? ""),
    yearLevel: String(formData.get("yearLevel") ?? ""),
    section: String(formData.get("section") ?? ""),
    email: String(formData.get("email") ?? ""),
  };
}

/**
 * Records a cash sale an admin takes in person — no GCash reference, no
 * receipt to review, approved immediately since staff already has the cash
 * in hand. Otherwise the same identity rules as online checkout: one active
 * registration per student ID.
 */
export async function submitWalkIn(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const adminId = await currentAdminId();
  if (!adminId) {
    return {
      status: "error",
      message: "Sign in again.",
      values: readValues(formData),
      attempt: _prev.attempt + 1,
    };
  }

  const values = readValues(formData);
  const attempt = _prev.attempt + 1;

  const parsed = walkInSchema.safeParse(values);
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

  const created = await createWalkInRegistration({
    ...parsed.data,
    amount: EVENT.ticketPriceCentavos,
    reviewedBy: adminId,
  });

  if (!created.ok) {
    if (created.error === "duplicate_student_id") {
      return {
        status: "error",
        message:
          "This student already has an active registration. Void it first " +
          "from Find a registration if this one should replace it.",
        fieldErrors: { studentId: "Already has an active registration." },
        values,
        attempt,
      };
    }
    return {
      status: "error",
      message: "Something went wrong saving this ticket. Try again in a moment.",
      values,
      attempt,
    };
  }

  after(() =>
    sendTicketApprovedEmail({
      to: parsed.data.email,
      fullName: parsed.data.fullName,
      ticketId: created.id,
    }),
  );

  redirect(`/ticket/${created.id}`);
}
