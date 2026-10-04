"use server";

import { redirect } from "next/navigation";
import { evaluationContext, saveEvaluation } from "@/lib/evaluation/queries";
import { FORM_VERSION, QUESTIONS } from "@/lib/evaluation/questions";
import { parseAnswers, type RawAnswers } from "@/lib/evaluation/schema";

export type FormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
  // Same reset-on-error problem as checkout's FormState.values — see the
  // comment there. Keying inputs on `attempt` keeps one missed question from
  // wiping every answer above it.
  values?: RawAnswers;
  attempt: number;
};

function readValues(formData: FormData): RawAnswers {
  return Object.fromEntries(
    QUESTIONS.map((question) => [
      question.id,
      // A tick-all question posts one field per ticked box under the same name.
      question.kind === "multi"
        ? formData.getAll(question.id).map(String)
        : String(formData.get(question.id) ?? ""),
    ]),
  );
}

/**
 * Records one attendee's evaluation, then sends them to their certificate page,
 * where they view or download it. Nothing is emailed: the page is the delivery.
 *
 * Eligibility is re-checked here and not trusted from the page that rendered
 * the form: the id in the URL is all an attendee holds, so the server decides
 * again, on every submit, whether this person was actually at the door.
 */
export async function submitEvaluation(
  registrationId: string,
  previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = readValues(formData);
  const attempt = previous.attempt + 1;
  const fail = (message: string, fieldErrors?: Record<string, string>) => ({
    status: "error" as const,
    message,
    fieldErrors,
    values,
    attempt,
  });

  const context = await evaluationContext(registrationId);
  if (!context) return fail("We could not find this link. Check your email again.");
  if (!context.checkedInAt) {
    return fail(
      "We have no record of you being scanned in at the door, so there's " +
        "nothing to evaluate yet.",
    );
  }
  if (context.registration.status === "partial") {
    return fail(
      "Your certificate is released once your balance is paid. Pay an " +
        "organiser, then come back to this link.",
    );
  }
  // Already answered — send them to what they came for rather than showing an
  // error about a form they filled in correctly.
  if (context.evaluation) redirect(`/certificate/${registrationId}`);

  const parsed = parseAnswers(values);
  if (!parsed.ok) {
    return fail("Answer the highlighted questions.", parsed.fieldErrors);
  }

  const saved = await saveEvaluation(
    registrationId,
    FORM_VERSION,
    parsed.answers,
  );

  if (!saved.ok) {
    if (saved.error === "already_submitted") {
      redirect(`/certificate/${registrationId}`);
    }
    return fail("Something went wrong saving this. Try again in a moment.");
  }

  redirect(`/certificate/${registrationId}`);
}
