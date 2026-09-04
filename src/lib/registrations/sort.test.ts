import { describe, expect, it } from "vitest";
import { sortRegistrations } from "./sort";
import type { Registration } from "@/lib/supabase/types";

const row = (over: Partial<Registration> = {}): Registration => ({
  id: "r1",
  full_name: "Maria Clara Santos",
  student_id: "2023-00451",
  year_level: "3rd year",
  section: "BSIT-3B",
  email: "maria@example.com",
  payment_method: "online",
  gcash_reference: "1234567890123",
  receipt_path: "2026/abc.jpg",
  amount: 49500,
  status: "approved",
  reject_reason: null,
  ticket_code: "ABCDEF123456",
  created_at: "2026-09-01T10:00:00+08:00",
  reviewed_at: "2026-09-01T10:05:00+08:00",
  reviewed_by: "admin-1",
  ...over,
});

describe("sortRegistrations", () => {
  const rows = [
    row({ id: "a", full_name: "Zeta Cruz", amount: 49500, created_at: "2026-09-01T10:00:00+08:00" }),
    row({ id: "b", full_name: "Ana Reyes", amount: 99000, created_at: "2026-09-03T10:00:00+08:00" }),
    row({ id: "c", full_name: "Miko Santos", amount: 25000, created_at: "2026-09-02T10:00:00+08:00" }),
  ];

  it("sorts by name alphabetically", () => {
    expect(sortRegistrations(rows, "name", "asc").map((r) => r.full_name)).toEqual([
      "Ana Reyes",
      "Miko Santos",
      "Zeta Cruz",
    ]);
  });

  it("sorts by amount", () => {
    expect(sortRegistrations(rows, "amount", "asc").map((r) => r.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("sorts by submitted date, ascending and descending", () => {
    expect(sortRegistrations(rows, "submitted", "asc").map((r) => r.id)).toEqual([
      "a",
      "c",
      "b",
    ]);
    expect(sortRegistrations(rows, "submitted", "desc").map((r) => r.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("does not mutate the input array", () => {
    const before = rows.map((r) => r.id);
    sortRegistrations(rows, "name", "asc");
    expect(rows.map((r) => r.id)).toEqual(before);
  });
});
