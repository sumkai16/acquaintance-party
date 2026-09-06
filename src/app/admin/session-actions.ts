"use server";

import { currentProfile } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity/queries";

export async function logLogin(): Promise<void> {
  const profile = await currentProfile();
  if (!profile) return;
  await logActivity({
    userId: profile.id,
    activityType: "login",
    description: `${profile.fullName} logged in`,
  });
}

/** Must be called BEFORE the client-side auth.signOut() — see admin-nav.tsx. */
export async function logLogout(): Promise<void> {
  const profile = await currentProfile();
  if (!profile) return;
  await logActivity({
    userId: profile.id,
    activityType: "logout",
    description: `${profile.fullName} logged out`,
  });
}
