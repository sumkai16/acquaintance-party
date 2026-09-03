import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { serverClient } from "@/lib/supabase/server";
import { AdminNav } from "./admin-nav";

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

  // AdminNav decides for itself whether to render on the current route
  // (scanner, raffle projector, and login all hide it) — see the comment
  // there for why that decision lives client-side, not here.
  return (
    <div className="min-h-screen bg-deep text-ground">
      {!isLogin ? <AdminNav /> : null}
      {children}
    </div>
  );
}
