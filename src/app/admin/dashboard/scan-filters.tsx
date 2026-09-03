"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { YEAR_LEVELS } from "@/lib/registrations/schema";

/**
 * Two dropdowns that narrow the Recent Scans table by year level and
 * section, driven by the same URL-param pattern as the table's column
 * sort (?sort=&dir=) rather than local state — so a filtered, sorted view
 * survives a refresh or a shared link.
 */
export function ScanFilters({ sections }: { sections: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const year = searchParams.get("year") ?? "";
  const section = searchParams.get("section") ?? "";

  function setParam(key: "year" | "section", value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
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
    </div>
  );
}
