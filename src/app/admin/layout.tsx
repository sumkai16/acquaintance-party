import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { serverClient } from "@/lib/supabase/server";
import { AdminNav, NavVisibilityProvider } from "./admin-nav";

// Sunset Soiree, throughout — see context/DESIGN.md §3. The one carve-out
// is the scanner's live scan result screens (full-screen green/red/amber,
// read at arm's length in the dark under time pressure), which stay
// untouched inside scanner.tsx itself; this shell doesn't reach them.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The login page lives under /admin but must stay reachable while signed
  // out. x-pathname is set by src/proxy.ts.
  const pathname = (await headers()).get("x-pathname") ?? "";

  const isLogin = pathname.endsWith("/admin/login");
  if (!isLogin) {
    const supabase = await serverClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) redirect("/admin/login");
  }

  // AdminNav shows on every non-login route now — a full-screen surface
  // nested in `children` (the scanner's live result screen, the raffle
  // wheel mid-spin) hides it for exactly that moment via useSetNavHidden,
  // which needs AdminNav and children under the same NavVisibilityProvider.
  //
  // flex-col here, so a page whose root is `flex-1` (raffle) gets exactly
  // the viewport height minus AdminNav's real rendered height, not another
  // full 100vh stacked under it — that stacking is what made the raffle
  // page (min-h-screen on its own <main>, same as this wrapper) scroll
  // when it never should. A page that doesn't opt into flex-1 (Payments,
  // Attendance, ...) renders exactly as before — flex only sizes children
  // that ask it to.
  return (
    <div className="flex min-h-screen flex-col bg-deep text-ground">
      {!isLogin ? (
        <NavVisibilityProvider>
          <AdminNav />
          {children}
        </NavVisibilityProvider>
      ) : (
        children
      )}
    </div>
  );
}
