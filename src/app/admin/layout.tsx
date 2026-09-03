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

  if (!pathname.endsWith("/admin/login")) {
    const supabase = await serverClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) redirect("/admin/login");
  }

  // The scanner and the raffle projector are both full-screen by design —
  // the scanner so a result fills the whole screen, the raffle so the show
  // has no admin chrome in view. Both fill their own bg-deep background.
  const showNav =
    !pathname.endsWith("/admin/login") &&
    !pathname.includes("/admin/scan") &&
    !pathname.includes("/admin/raffle");

  return (
    <div className="min-h-screen bg-deep text-ground">
      {showNav ? <AdminNav /> : null}
      {children}
    </div>
  );
}
