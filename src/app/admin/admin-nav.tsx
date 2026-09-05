"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { EVENT } from "@/lib/config/event";
import { browserClient } from "@/lib/supabase/browser";

const LINKS = [
  { href: "/admin/review", label: "Payments" },
  { href: "/admin/walk-in", label: "Walk-in" },
  { href: "/admin/scan", label: "Scanner" },
  { href: "/admin/dashboard", label: "Attendance" },
  { href: "/admin/raffle", label: "Raffle" },
  { href: "/admin/evaluations", label: "Evaluation" },
  { href: "/admin/registrations", label: "Find a registration" },
] as const;

type NavVisibility = { hidden: boolean; setHidden: (hidden: boolean) => void };
const NavVisibilityContext = createContext<NavVisibility | null>(null);

/**
 * Wraps AdminNav and the page content together (from admin/layout.tsx) so a
 * full-screen surface nested inside `children` — the scanner's live result
 * screen, the raffle wheel mid-spin — can reach up and hide the nav for
 * exactly that moment via useSetNavHidden. Everywhere else, including those
 * same pages' setup/idle states, the nav stays up, so every admin page is
 * reachable the same way.
 */
export function NavVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  return (
    <NavVisibilityContext.Provider value={{ hidden, setHidden }}>
      {children}
    </NavVisibilityContext.Provider>
  );
}

/** Call with `true` from a full-screen surface while it owns the whole screen. */
export function useSetNavHidden(hidden: boolean) {
  const ctx = useContext(NavVisibilityContext);
  useEffect(() => {
    ctx?.setHidden(hidden);
    return () => ctx?.setHidden(false);
  }, [hidden, ctx]);
}

/**
 * Rendered from admin/layout.tsx on every non-login admin route — replaces
 * each page's own hand-rolled, inconsistently-styled nav row so every admin
 * page is reachable the same way. Hiding is driven by useSetNavHidden, not a
 * static per-route exclusion — a previous version hid the whole scanner and
 * raffle routes outright via usePathname(), which also hid their setup/idle
 * states that had no reason to lose the nav.
 */
export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const hidden = useContext(NavVisibilityContext)?.hidden ?? false;

  if (hidden) return null;

  async function signOut() {
    await browserClient().auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <nav className="border-b border-ground/10">
      {/* Full-width, not the mx-auto max-w-5xl column every page's own
          content uses — the brand belongs at the true left edge, not
          inset to match a content column that isn't this bar's job to
          mirror. */}
      <div className="flex flex-wrap items-center gap-1 px-4 py-2.5 sm:px-5">
        {/* basis-full on mobile: its own row, so the wide letter-spacing
            below never has to compete with a nav pill for the same line —
            that's what was clipping it at 375px. Tracking itself also backs
            off on mobile, since 0.3em against this string is what caused
            the overflow in the first place. */}
        <span className="mr-2 basis-full text-xs uppercase tracking-[0.15em] text-ground/60 sm:basis-auto sm:shrink-0 sm:text-sm sm:tracking-[0.3em]">
          {EVENT.name}
        </span>

        {LINKS.map((link) => {
          const active = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus:outline-2 focus:outline-offset-2 focus:outline-accent-2 sm:px-3.5 ${
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
          className="ml-auto rounded-full px-3 py-1.5 text-sm font-medium text-ground/50 hover:bg-ground/10 hover:text-ground focus:outline-2 focus:outline-offset-2 focus:outline-accent-2 sm:px-3.5"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
