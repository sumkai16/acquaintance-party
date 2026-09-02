import { describe, expect, it } from "vitest";
import { SHEET_HEADERS, sheetRow } from "./row";

const scan = {
  codeScanned: "K4M92XQP7BTR",
  scannedAt: "2026-10-05T16:04:12+08:00",
  syncedAt: "2026-10-05T16:09:30+08:00",
  deviceLabel: "door-1",
  result: "ok" as const,
  fullName: "Maria Clara Santos",
  yearLevel: "3rd year",
  section: "BSIT-3B",
};

describe("sheetRow", () => {
  it("puts every cell in the order the headers promise", () => {
    const row = sheetRow(scan);

    expect(row).toHaveLength(SHEET_HEADERS.length);
    expect(row[SHEET_HEADERS.indexOf("Name")]).toBe("Maria Clara Santos");
    expect(row[SHEET_HEADERS.indexOf("Year level")]).toBe("3rd year");
    expect(row[SHEET_HEADERS.indexOf("Section")]).toBe("BSIT-3B");
    expect(row[SHEET_HEADERS.indexOf("Ticket code")]).toBe("K4M92XQP7BTR");
    expect(row[SHEET_HEADERS.indexOf("Door")]).toBe("door-1");
    expect(row[SHEET_HEADERS.indexOf("Result")]).toBe("ok");
  });

  it("renders both clocks in Manila time, whatever the server's timezone", () => {
    const row = sheetRow(scan);

    expect(row[SHEET_HEADERS.indexOf("Scanned at (device)")]).toBe(
      "2026-10-05 16:04:12",
    );
    expect(row[SHEET_HEADERS.indexOf("Synced at (server)")]).toBe(
      "2026-10-05 16:09:30",
    );
  });

  it("converts a UTC timestamp rather than printing it raw", () => {
    const row = sheetRow({ ...scan, scannedAt: "2026-10-05T08:04:12Z" });

    expect(row[SHEET_HEADERS.indexOf("Scanned at (device)")]).toBe(
      "2026-10-05 16:04:12",
    );
  });

  it("leaves the name blank when a scanned code matched nothing", () => {
    // An invalid scan has no registration, but the row still belongs in the
    // sheet — it is how someone spots a fake or mistyped code afterwards.
    const row = sheetRow({
      ...scan,
      result: "invalid",
      fullName: null,
      yearLevel: null,
      section: null,
    });

    expect(row[SHEET_HEADERS.indexOf("Name")]).toBe("");
    expect(row[SHEET_HEADERS.indexOf("Year level")]).toBe("");
    expect(row[SHEET_HEADERS.indexOf("Result")]).toBe("invalid");
    expect(row[SHEET_HEADERS.indexOf("Ticket code")]).toBe("K4M92XQP7BTR");
  });
});
