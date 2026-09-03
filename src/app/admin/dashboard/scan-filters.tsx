"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { YEAR_LEVELS } from "@/lib/registrations/schema";

const NAME_DEBOUNCE_MS = 300;

/**
 * A name search plus three dropdowns, narrowing the Recent Scans table by
 * name/year level/section/door — driven by the same URL-param pattern as
 * the table's column sort (?sort=&dir=) rather than local state, so a
 * filtered, sorted view survives a refresh or a shared link. The name field
 * is debounced (typing shouldn't push a new URL, and re-fetch, per
 * keystroke); the dropdowns commit immediately since a select change is
 * already one discrete action.
 */
export function ScanFilters({
  sections,
  doors,
}: {
  sections: string[];
  doors: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const year = searchParams.get("year") ?? "";
  const section = searchParams.get("section") ?? "";
  const door = searchParams.get("door") ?? "";
  const [name, setName] = useState(searchParams.get("name") ?? "");

  function setParam(key: "year" | "section" | "door" | "name", value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  useEffect(() => {
    // Skip the no-op push on mount (and after this effect's own navigation
    // updates searchParams) — only a real edit should debounce a new URL.
    if (name === (searchParams.get("name") ?? "")) return;
    const timer = setTimeout(() => setParam("name", name), NAME_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Search by name"
        aria-label="Filter by name"
        className="rounded-md border border-ground/20 bg-ground/5 px-3 py-2 text-sm text-ground outline-none placeholder:text-ground/40 focus:border-accent-2 focus:ring-2 focus:ring-accent-2/30"
      />

      <select
        value={year}
        onChange={(event) => setParam("year", event.target.value)}
        aria-label="Filter by year level"
        className="rounded-md border border-ground/20 bg-ground/5 px-3 py-2 text-sm text-ground outline-none focus:border-accent-2 focus:ring-2 focus:ring-accent-2/30"
      >
        <option value="">All year levels</option>
        {YEAR_LEVELS.map((level) => (
          <option key={level} value={level}>
            {level}
          </option>
        ))}
      </select>

      <select
        value={section}
        onChange={(event) => setParam("section", event.target.value)}
        aria-label="Filter by section"
        className="rounded-md border border-ground/20 bg-ground/5 px-3 py-2 text-sm text-ground outline-none focus:border-accent-2 focus:ring-2 focus:ring-accent-2/30"
      >
        <option value="">All sections</option>
        {sections.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>

      <select
        value={door}
        onChange={(event) => setParam("door", event.target.value)}
        aria-label="Filter by door"
        className="rounded-md border border-ground/20 bg-ground/5 px-3 py-2 text-sm text-ground outline-none focus:border-accent-2 focus:ring-2 focus:ring-accent-2/30"
      >
        <option value="">All doors</option>
        {doors.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
    </div>
  );
}
