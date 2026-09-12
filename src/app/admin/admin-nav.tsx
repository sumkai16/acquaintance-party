"use client";

import { createContext, Fragment, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { EVENT } from "@/lib/config/event";
import { browserClient } from "@/lib/supabase/browser";
import { logLogout } from "./session-actions";

/**
 * Grouped, not one flat run of nine, and ordered the way the event actually
 * runs: the overview, then taking money, then the door, then the night's
 * own screens, then the audit trail. A second admin handed this bar should
 * be able to find the cluster they need without having learned it. The
 * groups are separated visually but carry no headings — a label per group
 * would cost more room in the bar than the grouping saves.
 */
const ADMIN_GROUPS = [
  [{ href: "/admin/dashboard", label: "Dashboard" }],
  [
    { href: "/admin/review", label: "Payments" },
    { href: "/admin/walk-in", label: "Walk-in" },
    { href: "/admin/cash", label: "Cash" },
  ],
  [
    { href: "/admin/scan", label: "Scanner" },
    { href: "/admin/attendance", label: "Attendance" },
  ],
  [
    { href: "/admin/raffle", label: "Raffle" },
    { href: "/admin/evaluations", label: "Evaluation" },
  ],
  [{ href: "/admin/activity", label: "Activity" }],
] as const;

// Four links is still scannable as one group — same shape as ADMIN_GROUPS
// purely so both roles render through the same loop below.
const STAFF_GROUPS = [
  [
    { href: "/admin/cashier", label: "My Dashboard" },
    { href: "/admin/walk-in", label: "Walk-in" },
    { href: "/admin/scan", label: "Scanner" },
    { href: "/admin/cashier/activity", label: "My Activity" },
  ],
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
export function AdminNav({ role }: { role: "admin" | "staff" }) {
  const pathname = usePathname();
  const router = useRouter();
  const hidden = useContext(NavVisibilityContext)?.hidden ?? false;
  const GROUPS = role === "admin" ? ADMIN_GROUPS : STAFF_GROUPS;

  if (hidden) return null;

  async function signOut() {
    await logLogout(); // while the session cookie is still valid
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

        {GROUPS.map((group, index) => (
          <Fragment key={group[0].href}>
            {/* Hidden below sm on purpose: this bar wraps, and on a phone the
                pills run to several lines where a divider can strand itself
                at the start of a row. The grouping is a desktop-scanning
                aid; on mobile the order alone carries it. */}
            {index > 0 ? (
              <span
                aria-hidden
                className="mx-1.5 hidden h-5 w-px shrink-0 bg-ground/15 sm:block"
              />
            ) : null}

            {group.map((link) => {
              // Exact match, not startsWith: "/admin/cashier" is a literal
              // prefix of "/admin/cashier/activity", so a staff member on My
              // Activity was seeing both My Dashboard and My Activity lit up at
              // once. No linked section here nests a page under another
              // linked section's own path, so exact match loses nothing.
              const active = pathname === link.href;
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
          </Fragment>
        ))}

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
