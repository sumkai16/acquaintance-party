import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { getProfile } from "@/lib/profiles/queries";
import type { Profile } from "@/lib/supabase/types";

/**
 * The signed-in admin's id, or null. Every admin write gates on this.
 *
 * `cache()` deduplicates this per request, which matters because the answer
 * is asked for repeatedly on a single page load: AdminLayout gates the route
 * on it, and then the page under it (e.g. /admin/cashier) asks again through
 * currentProfile. Each ask was a separate `auth.getUser()` round trip to
 * Supabase in Singapore. Same validation as before — just not repeated
 * within one render.
 */
export const currentAdminId = cache(async (): Promise<string | null> => {
  const { data } = await (await serverClient()).auth.getUser();
  return data.user?.id ?? null;
});

/** The signed-in user's role and name, or null if not signed in or not provisioned. */
export async function currentProfile(): Promise<Profile | null> {
  const id = await currentAdminId();
  if (!id) return null;
  return getProfile(id);
}

/** Request-scoped client carrying the signed-in admin's session. */
export const serverClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            for (const { name, value, options } of toSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // The proxy refreshes the session instead, so this is safe.
          }
        },
      },
    },
  );
});
