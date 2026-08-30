import { createBrowserClient } from "@supabase/ssr";

/**
 * Anon client for the browser. Only the admin login page uses it — everything
 * else goes through server actions.
 */
export function browserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
