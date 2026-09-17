import "server-only";
import { currentProfile } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

export const ADMIN_ONLY_ERROR = "Admins only. Sign in with an admin account.";

/**
 * The signed-in admin's profile, or null for a staff account, an
 * unprovisioned account, or no session at all.
 *
 * Every admin-only server action must call this itself. admin/layout.tsx
 * only decides which *pages* staff can open; a server action is a POST
 * endpoint that can be invoked without its page, so being signed in
 * (currentAdminId) is not the same as being allowed.
 */
export async function requireAdmin(): Promise<Profile | null> {
  const profile = await currentProfile();
  return profile?.role === "admin" ? profile : null;
}
