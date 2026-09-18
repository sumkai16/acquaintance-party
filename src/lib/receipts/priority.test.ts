import { describe, expect, it } from "vitest";
import { backlogGroup, sortByPriority } from "./priority";

describe("backlogGroup", () => {
  it("puts a paid student with no QR email in the first group", () => {
    expect(backlogGroup({ status: "approved", ticket_email_sent_at: null })).toBe("qr");
  });

  it("puts a student who already has their QR last", () => {
    expect(
      backlogGroup({ status: "approved", ticket_email_sent_at: "2026-09-10T00:00:00Z" }),
    ).toBe("receipt");
  });

  it("puts a partial payer in the middle, whatever their email state", () => {
    expect(backlogGroup({ status: "partial", ticket_email_sent_at: null })).toBe("partial");
  });
});

describe("sortByPriority", () => {
  it("orders by group, keeping arrival order inside each group", () => {
    const sorted = sortByPriority([
      { id: "old-receipt", group: "receipt" as const },
      { id: "old-partial", group: "partial" as const },
      { id: "old-qr", group: "qr" as const },
      { id: "new-receipt", group: "receipt" as const },
      { id: "new-qr", group: "qr" as const },
    ]);
    expect(sorted.map((entry) => entry.id)).toEqual([
      "old-qr",
      "new-qr",
      "old-partial",
      "old-receipt",
      "new-receipt",
    ]);
  });
});
