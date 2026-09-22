"use server";

import { redirect } from "next/navigation";
import { normalizeStudentId } from "@/lib/registrations/schema";
import { findOwnRegistration } from "@/lib/registrations/queries";

export type FindState = {
  status: "idle" | "error";
  message?: string;
};

const initialMessage =
  "Enter both your student ID and the email you registered with.";

/**
 * One generic "no match" message regardless of which field was wrong — a
 * lookup that says "wrong email" or "wrong student ID" separately would let
 * someone probe for which student IDs are registered.
 */
const noMatchMessage =
  "No ticket found with that student ID and email. Check that both match " +
  "exactly what you submitted at checkout, or message an organiser.";

export async function findTicket(
  _prev: FindState,
  formData: FormData,
): Promise<FindState> {
  const studentId = normalizeStudentId(String(formData.get("studentId") ?? ""));
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!studentId || !email) {
    return { status: "error", message: initialMessage };
  }

  const registration = await findOwnRegistration(studentId, email);
  if (!registration) {
    return { status: "error", message: noMatchMessage };
  }

  redirect(`/ticket/${registration.id}`);
}
