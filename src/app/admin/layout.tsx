import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { serverClient } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The login page lives under /admin but must stay reachable while signed
  // out. x-pathname is set by src/proxy.ts.
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (pathname.endsWith("/admin/login")) return <>{children}</>;

  const supabase = await serverClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/admin/login");

  return <>{children}</>;
}
