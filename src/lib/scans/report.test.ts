import { describe, expect, it } from "vitest";
import { filterScans, findDoubleScans, sortScans, summarize, type ScanRecord } from "./report";

const row = (over: Partial<ScanRecord> = {}): ScanRecord => ({
  registrationId: "r1",
  fullName: "Maria Clara Santos",
  yearLevel: "3rd year",
  section: "BSIT-3B",
  codeScanned: "K4M92XQP7BTR",
  scannedAt: "2026-10-05T16:10:00+08:00",
  deviceLabel: "door-1",
  result: "ok",
  ...over,
});

describe("summarize", () => {
  it("counts distinct students admitted, not raw scans", () => {
    const summary = summarize(
      [row(), row({ result: "duplicate" }), row({ result: "duplicate" })],
      600,
    );
    expect(summary.checkedIn).toBe(1);
    expect(summary.totalScans).toBe(3);
  });

  it("reports how many sold tickets have not arrived", () => {
    const summary = summarize([row(), row({ registrationId: "r2" })], 600);
    expect(summary.checkedIn).toBe(2);
    expect(summary.notYetArrived).toBe(598);
  });

  it("counts invalid scans separately, since they are not attendance", () => {
    const summary = summarize(
      [row(), row({ registrationId: null, result: "invalid" })],
      600,
    );
    expect(summary.checkedIn).toBe(1);
    expect(summary.invalid).toBe(1);
  });

  it("handles an empty night without dividing by zero", () => {
    const summary = summarize([], 600);
    expect(summary.checkedIn).toBe(0);
    expect(summary.notYetArrived).toBe(600);
  });
});

describe("findDoubleScans", () => {
  it("flags one ticket admitted at two different doors", () => {
    const found = findDoubleScans([
      row(),
      row({ deviceLabel: "door-2", scannedAt: "2026-10-05T16:12:00+08:00" }),
    ]);
    expect(found).toHaveLength(1);
    expect(found[0].devices).toEqual(["door-1", "door-2"]);
    expect(found[0].fullName).toBe("Maria Clara Santos");
  });

  it("ignores a repeat the device already caught as a duplicate", () => {
    // The scanner said no the second time, so nobody got in twice.
    expect(
      findDoubleScans([row(), row({ result: "duplicate", deviceLabel: "door-2" })]),
    ).toHaveLength(0);
  });

  it("ignores the same door scanning once", () => {
    expect(findDoubleScans([row()])).toHaveLength(0);
  });

  it("returns nothing for a clean night", () => {
    expect(findDoubleScans([row(), row({ registrationId: "r2" })])).toHaveLength(0);
  });
});

describe("sortScans", () => {
  const rows = [
    row({ fullName: "Zeta Cruz", scannedAt: "2026-10-05T16:10:00+08:00", deviceLabel: "door-2", result: "ok" }),
    row({ fullName: "Ana Reyes", scannedAt: "2026-10-05T16:05:00+08:00", deviceLabel: "door-1", result: "duplicate" }),
    row({ fullName: "Miko Santos", scannedAt: "2026-10-05T16:15:00+08:00", deviceLabel: "door-1", result: "invalid" }),
  ];

  it("sorts by time, ascending and descending", () => {
    expect(sortScans(rows, "time", "asc").map((r) => r.fullName)).toEqual([
      "Ana Reyes",
      "Zeta Cruz",
      "Miko Santos",
    ]);
    expect(sortScans(rows, "time", "desc").map((r) => r.fullName)).toEqual([
      "Miko Santos",
      "Zeta Cruz",
      "Ana Reyes",
    ]);
  });

  it("sorts by name alphabetically", () => {
    expect(sortScans(rows, "name", "asc").map((r) => r.fullName)).toEqual([
      "Ana Reyes",
      "Miko Santos",
      "Zeta Cruz",
    ]);
  });

  it("treats a missing name as sorting last, not crashing", () => {
    const withMissing = [...rows, row({ fullName: null })];
    const sorted = sortScans(withMissing, "name", "asc");
    expect(sorted[sorted.length - 1].fullName).toBeNull();
  });

  it("sorts by result", () => {
    expect(sortScans(rows, "result", "asc").map((r) => r.result)).toEqual([
      "duplicate",
      "invalid",
      "ok",
    ]);
  });

  it("sorts by door", () => {
    expect(sortScans(rows, "door", "asc").map((r) => r.deviceLabel)).toEqual([
      "door-1",
      "door-1",
      "door-2",
    ]);
  });

  it("does not mutate the input array", () => {
    const before = rows.map((r) => r.fullName);
    sortScans(rows, "time", "asc");
    expect(rows.map((r) => r.fullName)).toEqual(before);
  });
});

describe("filterScans", () => {
  const rows = [
    row({ fullName: "Ana Reyes", yearLevel: "1st year", section: "BSIT-1A" }),
    row({ fullName: "Miko Santos", yearLevel: "2nd year", section: "BSIT-2A" }),
    row({ fullName: "Zeta Cruz", yearLevel: "2nd year", section: "BSIT-2B" }),
    row({
      fullName: null,
      registrationId: null,
      yearLevel: null,
      section: null,
      result: "invalid",
    }),
  ];

  it("returns everything when no filter is set", () => {
    expect(filterScans(rows, {})).toHaveLength(4);
  });

  it("filters by year level", () => {
    const found = filterScans(rows, { year: "2nd year" });
    expect(found.map((r) => r.fullName)).toEqual(["Miko Santos", "Zeta Cruz"]);
  });

  it("filters by section", () => {
    const found = filterScans(rows, { section: "BSIT-2B" });
    expect(found.map((r) => r.fullName)).toEqual(["Zeta Cruz"]);
  });

  it("filters by year and section together", () => {
    const found = filterScans(rows, { year: "2nd year", section: "BSIT-2A" });
    expect(found.map((r) => r.fullName)).toEqual(["Miko Santos"]);
  });

  it("excludes rows with no year/section (e.g. invalid scans) once a filter is active", () => {
    const found = filterScans(rows, { year: "2nd year" });
    expect(found.every((r) => r.fullName !== null)).toBe(true);
  });

  it("treats an empty-string filter the same as unset", () => {
    expect(filterScans(rows, { year: "", section: "" })).toHaveLength(4);
  });

  it("filters by name, case-insensitively and by substring", () => {
    expect(filterScans(rows, { name: "ana" }).map((r) => r.fullName)).toEqual([
      "Ana Reyes",
    ]);
    expect(filterScans(rows, { name: "cruz" }).map((r) => r.fullName)).toEqual([
      "Zeta Cruz",
    ]);
  });

  it("excludes rows with no name once a name filter is active", () => {
    const found = filterScans(rows, { name: "a" });
    expect(found.every((r) => r.fullName !== null)).toBe(true);
  });

  it("combines a name filter with year/section filters", () => {
    const found = filterScans(rows, { name: "santos", year: "2nd year" });
    expect(found.map((r) => r.fullName)).toEqual(["Miko Santos"]);
  });

  it("filters by door", () => {
    const doorRows = [
      row({ fullName: "Ana Reyes", deviceLabel: "door-1" }),
      row({ fullName: "Miko Santos", deviceLabel: "door-2" }),
    ];
    expect(filterScans(doorRows, { door: "door-2" }).map((r) => r.fullName)).toEqual([
      "Miko Santos",
    ]);
  });
});
