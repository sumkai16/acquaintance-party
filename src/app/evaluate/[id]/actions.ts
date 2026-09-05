"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { certificateFor } from "@/lib/certificates/data";
import { certificatePdf } from "@/lib/certificates/pdf";
import {
  certificateFilename,
  renderCertificatePng,
} from "@/lib/certificates/render";
import { evaluationContext, saveEvaluation } from "@/lib/evaluation/queries";
import { FORM_VERSION, QUESTIONS } from "@/lib/evaluation/questions";
import { parseAnswers } from "@/lib/evaluation/schema";
import { sendCertificateEmail } from "@/lib/notify/email";

export type FormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
  // Same reset-on-error problem as checkout's FormState.values — see the
  // comment there. Keying inputs on `attempt` keeps one missed question from
  // wiping every answer above it.
  values?: Record<string, string>;
  attempt: number;
};

function readValues(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    QUESTIONS.map((question) => [
      question.id,
      String(formData.get(question.id) ?? ""),
    ]),
  );
}

/**
 * Records one attendee's evaluation, then sends them to their certificate.
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

  const { email, full_name: fullName } = context.registration;
  after(() => emailCertificate(registrationId, email, fullName));

  redirect(`/certificate/${registrationId}`);
}

/**
 * Best-effort: the certificate is already on screen by the time this runs, so
 * a failure here costs a keepsake copy, not the certificate itself.
 */
async function emailCertificate(
  registrationId: string,
  to: string,
  fullName: string,
): Promise<void> {
  try {
    const certificate = await certificateFor(registrationId);
    if (!certificate) return;

    const pdf = await certificatePdf(await renderCertificatePng(certificate));
    await sendCertificateEmail({
      to,
      fullName,
      registrationId,
      pdf: Buffer.from(pdf),
      filename: `${certificateFilename(fullName)}.pdf`,
    });
  } catch (error) {
    console.error("emailCertificate failed", registrationId, error);
  }
}
