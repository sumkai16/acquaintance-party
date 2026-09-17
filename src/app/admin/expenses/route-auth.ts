import "server-only";
import { getProfile } from "@/lib/profiles/queries";
import { currentAdminId } from "@/lib/supabase/server";

/**
 * Route handlers don't pass through admin/layout.tsx's role gate, so each
 * Expenses route checks for itself. Returns the error Response to send, or
 * null when the caller is an admin.
 */
export async function adminOnlyResponse(): Promise<Response | null> {
  const userId = await currentAdminId();
  if (!userId) return Response.json({ error: "Sign in again." }, { status: 401 });
  const profile = await getProfile(userId);
  if (profile?.role !== "admin") return Response.json({ error: "Admins only." }, { status: 403 });
  return null;
}
