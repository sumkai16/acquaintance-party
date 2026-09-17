import { describe, expect, it } from "vitest";
import { isBlankRow, isValidImportData, validateExpenseRow } from "./import-rows";

const good = { item: "Tarpaulin", amount: "350", method: "Cash", date: "2026-01-15 09:30" };

describe("validateExpenseRow", () => {
  it("accepts a well-formed text row", () => {
    const row = validateExpenseRow(2, good);
    expect(row.ok).toBe(true);
    expect(row.data).toEqual({
      itemName: "Tarpaulin",
      amountCentavos: 35000,
      method: "cash",
      spentAtIso: "2026-01-15T09:30:00+08:00",
    });
  });

  it("accepts GCash spelled several ways", () => {
    for (const method of ["GCash", "gcash", "G-Cash", "g cash"]) {
      expect(validateExpenseRow(2, { ...good, method }).data?.method).toBe("gcash");
    }
  });

  it("reads a numeric amount cell", () => {
    expect(validateExpenseRow(2, { ...good, amount: 1250.5 }).data?.amountCentavos).toBe(125050);
  });

  it("reads a real Excel date cell as Manila wall-clock time", () => {
    const cell = new Date(Date.UTC(2026, 0, 15, 18, 45));
    expect(validateExpenseRow(2, { ...good, date: cell }).data?.spentAtIso).toBe(
      "2026-01-15T18:45:00+08:00",
    );
  });

  it("accepts a date with no time as midnight", () => {
    expect(validateExpenseRow(2, { ...good, date: "2026-01-15" }).data?.spentAtIso).toBe(
      "2026-01-15T00:00:00+08:00",
    );
  });

  it("flags a bad method", () => {
    expect(validateExpenseRow(2, { ...good, method: "card" }).error).toBe(
      "Payment method must be Cash or GCash.",
    );
  });

  it("flags a bad amount", () => {
    expect(validateExpenseRow(2, { ...good, amount: "abc" }).error).toBe(
      "Amount must be a positive peso amount.",
    );
  });

  it("flags an unreadable date", () => {
    expect(validateExpenseRow(2, { ...good, date: "next friday" }).error).toBe(
      "Date must be like 2026-10-03 18:30.",
    );
  });

  it("flags a short item name", () => {
    expect(validateExpenseRow(2, { ...good, item: "x" }).ok).toBe(false);
  });
});

describe("isBlankRow", () => {
  it("is true only when every cell is empty", () => {
    expect(isBlankRow({ item: "", amount: null, method: "", date: null })).toBe(true);
    expect(isBlankRow({ item: "", amount: 5, method: "", date: null })).toBe(false);
  });
});

describe("isValidImportData", () => {
  it("rejects tampered data", () => {
    const data = validateExpenseRow(2, good).data!;
    expect(isValidImportData(data)).toBe(true);
    expect(isValidImportData({ ...data, amountCentavos: -1 })).toBe(false);
    expect(isValidImportData({ ...data, method: "card" as never })).toBe(false);
  });
});
