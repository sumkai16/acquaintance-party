import "server-only";
import { evaluationContext } from "@/lib/evaluation/queries";
import type { CertificateData } from "./render";

/** The absolute site origin, or null when it isn't configured. */
export function siteUrl(): string | null {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? null;
}

/**
 * The certificate for one registration, or null when there isn't one to give.
 *
 * Both gates live here so the page, the PNG route, the PDF route and the email
 * can never disagree about who is entitled to a certificate: they must have
 * been scanned in at the door, and they must have submitted the evaluation.
 */
export async function certificateFor(
  registrationId: string,
): Promise<CertificateData | null> {
  const context = await evaluationContext(registrationId);
  if (!context) return null;

  const { registration, checkedInAt, evaluation } = context;
  if (!checkedInAt || !evaluation || !registration.ticket_code) return null;

  const base = siteUrl();

  return {
    fullName: registration.full_name,
    yearLevel: registration.year_level,
    section: registration.section,
    serial: registration.ticket_code,
    verifyUrl: base ? `${base}/verify/${registration.ticket_code}` : null,
  };
}
