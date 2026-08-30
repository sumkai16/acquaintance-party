import { describe, expect, it } from "vitest";
import { findDoubleScans, summarize, type ScanRecord } from "./report";

const row = (over: Partial<ScanRecord> = {}): ScanRecord => ({
  registrationId: "r1",
  fullName: "Maria Clara Santos",
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
