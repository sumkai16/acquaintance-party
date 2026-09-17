import { signedImportFileUrl } from "@/lib/import-batches/queries";
import { adminOnlyResponse } from "../../../route-auth";

/** Redirects to a fresh 10-minute signed download of the original uploaded file. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminOnlyResponse();
  if (denied) return denied;

  const { id } = await params;
  const url = await signedImportFileUrl(id);
  if (!url) return Response.json({ error: "File not found for this import." }, { status: 404 });

  return Response.redirect(url, 302);
}
