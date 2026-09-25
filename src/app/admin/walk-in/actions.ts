"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { EVENT, formatPeso } from "@/lib/config/event";
import { walkInSchema } from "@/lib/registrations/schema";
import { completeWalkInBalance, createWalkInRegistration } from "@/lib/registrations/queries";
import { emailDomainProblem } from "@/lib/registrations/mx";
import { isValidPartialAmount } from "@/lib/registrations/partial";
import { RATE_LABEL, parseTicketRate, priceFor } from "@/lib/registrations/rates";
import { parsePesoToCentavos } from "@/lib/expenses/parse";
import { currentAdminId, currentProfile } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity/queries";
import { sendPartialPaymentEmail } from "@/lib/notify/email";
import {
  issueReceiptOrLog,
  markReceiptsEmailed,
  unemailedReceiptIds,
} from "@/lib/receipts/queries";
import { scheduleWalkInTicketEmail } from "./notify";

export type SubmittedValues = {
  fullName: string;
  studentId: string;
  yearLevel: string;
  section: string;
  email: string;
  /** Raw text as typed — parsed and validated separately from walkInSchema, since it isn't an identity field. */
  amount: string;
  /** "regular" | "officer" | "free" — anything but regular is admin-only, checked in submitWalkIn. */
  rate: string;
};

export type FormState = {
  status: "idle" | "error" | "success";
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
    amount: String(formData.get("amount") ?? ""),
    rate: String(formData.get("rate") ?? "regular"),
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
  const fieldErrors: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0]);
      fieldErrors[field] ??= issue.message;
    }
  }

  // Checked alongside the identity fields, not after, for the same reason
  // checkout's receipt check is — one pass reports every invalid field at
  // once instead of the amount only surfacing once everything else is fixed.
  //
  // The rate decides the price. An officer or free ticket is admin-only and
  // always paid in full — checked here, not just by hiding the picker, since
  // this action is a POST endpoint staff could call without the form.
  const rate = parseTicketRate(values.rate);
  const isAdmin = (await currentProfile())?.role === "admin";
  if (rate === null || (rate !== "regular" && !isAdmin)) {
    return {
      status: "error",
      message:
        rate === null
          ? "Pick a ticket rate."
          : "Only an admin can record an officer or free ticket.",
      values: { ...values, rate: "regular" },
      attempt,
    };
  }

  const fullPrice = priceFor(rate);
  const amountCentavos = rate === "regular" ? parsePesoToCentavos(values.amount) : fullPrice;
  if (amountCentavos === null) {
    fieldErrors.amount = "Enter a valid amount.";
  } else if (amountCentavos > fullPrice) {
    fieldErrors.amount = `Can't exceed the full price (${formatPeso(fullPrice)}).`;
  } else if (amountCentavos < fullPrice && !isValidPartialAmount(amountCentavos, fullPrice)) {
    fieldErrors.amount = `A partial payment must be at least ${formatPeso(EVENT.partialPaymentMinCentavos)}.`;
  }

  if (parsed.success && !fieldErrors.email) {
    const domainProblem = await emailDomainProblem(parsed.data.email);
    if (domainProblem) fieldErrors.email = domainProblem;
  }

  if (!parsed.success || fieldErrors.amount || fieldErrors.email) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors,
      values,
      attempt,
    };
  }

  // Already validated as a well-formed, in-range amount above (that's what
  // makes fieldErrors.amount falsy) — TS can't follow that through the
  // merged if/else-if chain on its own, same as checkout/actions.ts's
  // validReceipt assertion just above its own equivalent guard.
  const amount = amountCentavos as number;
  const partialAmountCentavos = amount < fullPrice ? amount : undefined;

  const created = await createWalkInRegistration({
    ...parsed.data,
    amount: fullPrice,
    reviewedBy: adminId,
    partialAmountCentavos,
    ticketRate: rate,
  });

  if (!created.ok) {
    if (created.error === "duplicate_student_id") {
      return {
        status: "error",
        message:
          "This student already has a ticket. Void it first " +
          "from Find a registration if this one should replace it.",
        fieldErrors: { studentId: "Already has a ticket." },
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

  const profile = await currentProfile();
  // A free ticket has no payment to acknowledge — and the receipts table
  // rejects a ₱0 row — so it simply gets none. The QR email still goes out.
  const receiptIds =
    amount > 0
      ? await issueReceiptOrLog({
          registrationId: created.id,
          fullName: parsed.data.fullName,
          amount,
          method: "cash",
          balanceAfter: fullPrice - amount,
          receivedBy: adminId,
          paidAt: new Date().toISOString(),
        })
      : [];

  if (partialAmountCentavos !== undefined) {
    const owedCentavos = fullPrice - partialAmountCentavos;

    after(async () => {
      const status = await sendPartialPaymentEmail({
        to: parsed.data.email,
        fullName: parsed.data.fullName,
        ticketId: created.id,
        paidCentavos: partialAmountCentavos,
        owedCentavos,
        receiptIds,
      });
      if (status === "sent") await markReceiptsEmailed(receiptIds);
      if (status === "failed") {
        await logActivity({
          userId: adminId,
          activityType: "email_failed",
          description: `Partial payment email to ${parsed.data.email} failed to send for ${parsed.data.fullName}`,
          registrationId: created.id,
        });
      }
    });

    await logActivity({
      userId: adminId,
      activityType: "walk_in_partial_payment_added",
      description: `${profile?.fullName ?? "Someone"} recorded a walk-in partial payment for ${parsed.data.fullName} (${parsed.data.studentId})`,
      registrationId: created.id,
      amount: partialAmountCentavos,
    });

    return {
      status: "success",
      message:
        `Recorded ${parsed.data.fullName}'s partial payment (${formatPeso(partialAmountCentavos)}) — ` +
        `${formatPeso(owedCentavos)} still owed, no ticket yet.`,
      attempt,
    };
  }

  scheduleWalkInTicketEmail(adminId, {
    to: parsed.data.email,
    fullName: parsed.data.fullName,
    ticketId: created.id,
    ticketCode: created.ticketCode ?? undefined,
    receiptIds,
  });

  await logActivity({
    userId: adminId,
    activityType: "walk_in_payment_added",
    description:
      rate === "regular"
        ? `${profile?.fullName ?? "Someone"} recorded a walk-in payment for ${parsed.data.fullName} (${parsed.data.studentId})`
        : `${profile?.fullName ?? "Someone"} recorded a ${RATE_LABEL[rate].toLowerCase()} ticket for ${parsed.data.fullName} (${parsed.data.studentId})`,
    registrationId: created.id,
    amount,
  });

  return {
    status: "success",
    message:
      rate === "regular"
        ? `Recorded ${parsed.data.fullName}'s walk-in sale — ticket emailed to ${parsed.data.email}.`
        : `Recorded ${parsed.data.fullName}'s ${RATE_LABEL[rate].toLowerCase()} ticket (${formatPeso(amount)}) — ticket emailed to ${parsed.data.email}.`,
    attempt,
  };
}

export type BalanceActionResult = { ok: boolean; error?: string };

/**
 * Settles the remaining balance of a partial walk-in — staff-reachable, like
 * recording the sale itself, since staff are the ones actually collecting
 * the cash and can't reach Find a registration (admin-only) to do it there.
 */
export async function completeWalkInBalanceAction(
  id: string,
): Promise<BalanceActionResult> {
  const adminId = await currentAdminId();
  if (!adminId) return { ok: false, error: "Sign in again." };

  const completed = await completeWalkInBalance(id, EVENT.ticketPriceCentavos);
  if (!completed.ok) {
    return {
      ok: false,
      error:
        completed.error === "not_partial"
          ? "This balance was already settled."
          : "Something went wrong. Try again.",
    };
  }

  await issueReceiptOrLog({
    registrationId: completed.id,
    fullName: completed.fullName,
    amount: completed.collectedNowCentavos,
    method: "cash",
    balanceAfter: 0,
    receivedBy: adminId,
    paidAt: new Date().toISOString(),
  });

  scheduleWalkInTicketEmail(adminId, {
    to: completed.email,
    fullName: completed.fullName,
    ticketId: completed.id,
    ticketCode: completed.ticketCode,
    // This payment's receipt, plus the first one if its email never made it.
    receiptIds: await unemailedReceiptIds(completed.id),
  });

  const profile = await currentProfile();
  await logActivity({
    userId: adminId,
    activityType: "walk_in_balance_paid",
    description: `${profile?.fullName ?? "Someone"} recorded the remaining balance for ${completed.fullName} (${completed.studentId})`,
    registrationId: completed.id,
    amount: completed.collectedNowCentavos,
  });

  revalidatePath("/admin/walk-in");
  return { ok: true };
}
