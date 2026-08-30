import { describe, expect, it } from "vitest";
import { ticketQrDataUrl } from "./qr";

describe("ticketQrDataUrl", () => {
  it("returns a PNG data URL that an img tag can render", async () => {
    const url = await ticketQrDataUrl("K4M92XQP7BTR");
    expect(url.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("is deterministic, so the same ticket always looks the same", async () => {
    const a = await ticketQrDataUrl("K4M92XQP7BTR");
    const b = await ticketQrDataUrl("K4M92XQP7BTR");
    expect(a).toBe(b);
  });

  it("encodes different codes as different images", async () => {
    const a = await ticketQrDataUrl("K4M92XQP7BTR");
    const b = await ticketQrDataUrl("ZZZZ1111ZZZZ");
    expect(a).not.toBe(b);
  });

  it("renders large enough to scan from a phone screen", async () => {
    // A 512px QR is several kilobytes of base64. A few hundred bytes would
    // mean the image came out too small to focus on at the door.
    const url = await ticketQrDataUrl("K4M92XQP7BTR");
    expect(url.length).toBeGreaterThan(1000);
  });
});
