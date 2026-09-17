import { signedExpenseReceiptUrl } from "@/lib/expenses/queries";
import { adminOnlyResponse } from "../../route-auth";

/**
 * Mints a fresh 10-minute signed URL on every click and redirects to it —
 * a signed URL rendered into the page would already be dead if the page
 * sat open for more than ten minutes.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminOnlyResponse();
  if (denied) return denied;

  const { id } = await params;
  const url = await signedExpenseReceiptUrl(id);
  if (!url) return Response.json({ error: "No receipt for this expense." }, { status: 404 });

  return Response.redirect(url, 302);
}
