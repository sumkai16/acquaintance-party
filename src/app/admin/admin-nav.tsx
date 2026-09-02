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

/**
 * Rendered once, from admin/layout.tsx, for every admin route except login
 * (no session yet), the scanner (full-screen by design, no chrome), and the
 * raffle projector (its own Night Set header already has an Attendance
 * link) — replaces each page's own hand-rolled, inconsistently-styled nav
 * row.
 */
export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await browserClient().auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <nav className="border-b border-slate-300 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-1 px-5 py-2.5">
        {LINKS.map((link) => {
          const active = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors focus:outline-2 focus:outline-offset-2 focus:outline-slate-500 ${
                active
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {link.label}
            </Link>
          );
        })}

        <button
          type="button"
          onClick={signOut}
          className="ml-auto rounded px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus:outline-2 focus:outline-offset-2 focus:outline-slate-500"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
