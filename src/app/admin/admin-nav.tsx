"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/browser";

const LINKS = [
  { href: "/admin/review", label: "Review queue" },
  { href: "/admin/scan", label: "Scanner" },
  { href: "/admin/dashboard", label: "Attendance" },
  { href: "/admin/raffle", label: "Raffle" },
  { href: "/admin/registrations", label: "Find a registration" },
] as const;

const HIDDEN_ON = ["/admin/scan", "/admin/raffle"];

/**
 * Rendered from admin/layout.tsx on every admin route — replaces each
 * page's own hand-rolled, inconsistently-styled nav row.
 *
 * The two full-screen surfaces (scanner, raffle projector) hide it by
 * returning null here, using usePathname() rather than a server-side check
 * in the layout — a previous version gated this from layout.tsx via a
 * custom x-pathname header set in middleware, which came back empty on some
 * client-side navigations (an empty string trivially passes every "does not
 * include" exclusion check), so the nav rendered anyway on top of the
 * scanner's own header. usePathname() is always accurate, on every render,
 * so the exclusion belongs here.
 */
export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  if (HIDDEN_ON.some((prefix) => pathname.startsWith(prefix))) return null;

  async function signOut() {
    await browserClient().auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <nav className="border-b border-ground/10">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-1 px-5 py-2.5">
        {LINKS.map((link) => {
          const active = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus:outline-2 focus:outline-offset-2 focus:outline-accent-2 ${
                active
                  ? "bg-accent text-white"
                  : "text-ground/70 hover:bg-ground/10 hover:text-ground"
              }`}
            >
              {link.label}
            </Link>
          );
        })}

        <button
          type="button"
          onClick={signOut}
          className="ml-auto rounded-full px-3.5 py-1.5 text-sm font-medium text-ground/50 hover:bg-ground/10 hover:text-ground focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
