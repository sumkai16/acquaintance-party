import { redirect } from "next/navigation";
import { currentProfile } from "@/lib/supabase/server";

/**
 * `/admin` on its own used to 404 — the section had a layout but no index,
 * so the one URL an organiser is most likely to type from memory was the
 * one that went nowhere.
 *
 * The role split is the same one login-form.tsx makes after a successful
 * sign-in, spelled out here rather than left to admin/layout.tsx's gate:
 * the layout would bounce a signed-out visitor and a staff member to the
 * same places anyway, but only as a side effect of rendering order. Naming
 * the destination makes this route's behaviour readable on its own.
 */
export default async function AdminIndexPage() {
  const profile = await currentProfile();
  if (!profile) redirect("/admin/login");
  redirect(profile.role === "staff" ? "/admin/cashier" : "/admin/dashboard");
}
