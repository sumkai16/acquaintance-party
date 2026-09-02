import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { serverClient } from "@/lib/supabase/server";
import { AdminNav } from "./admin-nav";

// Admin is a deliberately neutral shell — no theme accent, no display font.
// See context/DESIGN.md §3: the public surfaces get the festival identity,
// admin is a tool someone works through quickly, under pressure, on a phone.
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

  // The scanner is full-screen by design (read at arm's length, in the
  // dark) and the raffle projector already has its own Night Set header
  // with an Attendance link — neither wants this neutral chrome on top.
  const showNav =
    !pathname.endsWith("/admin/login") &&
    !pathname.includes("/admin/scan") &&
    !pathname.includes("/admin/raffle");

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {showNav ? <AdminNav /> : null}
      {children}
    </div>
  );
}
