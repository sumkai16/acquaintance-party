import type { Registration } from "@/lib/supabase/types";

export type RegistrationSortColumn = "name" | "amount" | "submitted";

function sortKey(row: Registration, column: RegistrationSortColumn): string | number {
  switch (column) {
    case "name":
      return row.full_name.toLowerCase();
    case "amount":
      return row.amount;
    case "submitted":
      return row.created_at;
  }
}

/** Pure — mirrors sortScans in src/lib/scans/report.ts. The page just renders whatever order this returns. */
export function sortRegistrations(
  rows: Registration[],
  column: RegistrationSortColumn,
  direction: "asc" | "desc",
): Registration[] {
  const sorted = [...rows].sort((a, b) => {
    const ka = sortKey(a, column);
    const kb = sortKey(b, column);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  return direction === "asc" ? sorted : sorted.reverse();
}
