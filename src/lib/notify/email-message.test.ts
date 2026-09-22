import { describe, expect, it } from "vitest";
import {
  buildCertificateEmail,
  buildEvaluationInviteEmail,
  buildPartialPaymentEmail,
  buildReceiptBacklogEmail,
  buildTicketApprovedEmail,
  buildTicketSubmittedEmail,
} from "./email-message";

const base = {
  fullName: "Juan Miguel Dela Cruz",
  url: "https://it2026.vercel.app/ticket/abc-123",
};

describe("buildTicketSubmittedEmail", () => {
  it("greets the student by name and links their ticket", () => {
    const email = buildTicketSubmittedEmail(base);
    expect(email.subject).toContain("Acquaintance Party");
    expect(email.html).toContain("Juan Miguel Dela Cruz");
    expect(email.html).toContain(base.url);
    expect(email.text).toContain("Juan Miguel Dela Cruz");
    expect(email.text).toContain(base.url);
  });

  it("sets expectations that approval is manual, not instant", () => {
    // The whole point of this email is to be found later if the tab is
    // lost — it must not imply the ticket is already valid.
    const email = buildTicketSubmittedEmail(base);
    expect(email.html.toLowerCase()).toMatch(/review|check/);
  });

  it("escapes HTML-significant characters in the name so a stray < or & can't break the markup", () => {
    const email = buildTicketSubmittedEmail({
      ...base,
      fullName: "A & B <script>",
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("A &amp; B &lt;script&gt;");
  });
});

describe("buildTicketApprovedEmail", () => {
  it("greets the student by name and links their approved ticket", () => {
    const email = buildTicketApprovedEmail(base);
    expect(email.subject.toLowerCase()).toContain("approved");
    expect(email.html).toContain("Juan Miguel Dela Cruz");
    expect(email.html).toContain(base.url);
    expect(email.text).toContain(base.url);
  });

  it("escapes HTML-significant characters in the name", () => {
    const email = buildTicketApprovedEmail({
      ...base,
      fullName: "A & B <script>",
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("A &amp; B &lt;script&gt;");
  });

  it("shows the QR itself, and the code with it, when given one", () => {
    const email = buildTicketApprovedEmail({
      ...base,
      qrUrl: "https://it2026.vercel.app/ticket/abc-123/qr",
      ticketCode: "A1B2C3D4E5F6",
    });
    expect(email.html).toContain(
      '<img src="https://it2026.vercel.app/ticket/abc-123/qr"',
    );
    // Dashed, the same grouping the ticket page prints — a volunteer reads
    // this aloud when a camera won't focus.
    expect(email.html).toContain("A1B2-C3D4-E5F6");
    expect(email.text).toContain("A1B2-C3D4-E5F6");
    // The link never goes away: a client that blocks remote images has to
    // leave the student somewhere to go.
    expect(email.html).toContain(base.url);
  });

  it("falls back to the link-only message when there's no QR URL", () => {
    const email = buildTicketApprovedEmail(base);
    expect(email.html).not.toContain("<img");
    expect(email.html).toContain(base.url);
  });

  it("points the image at the inline attachment when a cid is given", () => {
    const email = buildTicketApprovedEmail({
      ...base,
      qrUrl: "https://it2026.vercel.app/ticket/abc-123/qr",
      ticketCode: "A1B2C3D4E5F6",
      qrCid: "ticket-qr",
    });
    expect(email.html).toContain('<img src="cid:ticket-qr"');
    expect(email.html).not.toContain(
      '<img src="https://it2026.vercel.app/ticket/abc-123/qr"',
    );
    // The hosted link still appears elsewhere (the CTA / plain-text
    // fallback), for a client that can't render the inline attachment.
    expect(email.html).toContain(base.url);
  });
});

describe("buildEvaluationInviteEmail", () => {
  it("links the evaluation and names the certificate as the payoff", () => {
    const email = buildEvaluationInviteEmail(base);
    expect(email.html).toContain("Juan Miguel Dela Cruz");
    expect(email.html).toContain(base.url);
    expect(email.text).toContain(base.url);
    expect(email.html.toLowerCase()).toContain("certificate");
  });

  it("says the evaluation comes first, so the certificate isn't a bait", () => {
    const email = buildEvaluationInviteEmail(base);
    expect(email.text.toLowerCase()).toMatch(/evaluation/);
  });

  it("escapes HTML-significant characters in the name", () => {
    const email = buildEvaluationInviteEmail({
      ...base,
      fullName: "A & B <script>",
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("A &amp; B &lt;script&gt;");
  });
});

describe("buildPartialPaymentEmail", () => {
  it("states what was paid and what's still owed, without a QR", () => {
    const email = buildPartialPaymentEmail({
      ...base,
      paidCentavos: 25000,
      owedCentavos: 25000,
    });
    expect(email.html).toContain("₱250");
    expect(email.text).toContain("₱250");
    expect(email.html).not.toContain("<img");
    expect(email.html.toLowerCase()).toMatch(/held|owed|due/);
  });

  it("links the ticket status page", () => {
    const email = buildPartialPaymentEmail({
      ...base,
      paidCentavos: 25000,
      owedCentavos: 25000,
    });
    expect(email.html).toContain(base.url);
    expect(email.text).toContain(base.url);
  });

  it("escapes HTML-significant characters in the name", () => {
    const email = buildPartialPaymentEmail({
      ...base,
      fullName: "A & B <script>",
      paidCentavos: 25000,
      owedCentavos: 25000,
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("A &amp; B &lt;script&gt;");
  });
});

const receiptUrl = "https://it2026.vercel.app/receipt/r-1";

describe("receipt links", () => {
  it("adds a receipt link to the approval email when given one", () => {
    const email = buildTicketApprovedEmail({ ...base, receiptUrls: [receiptUrl] });
    expect(email.html).toContain(receiptUrl);
    expect(email.text).toContain(receiptUrl);
  });

  it("leaves the approval email unchanged without one", () => {
    expect(buildTicketApprovedEmail(base).html).not.toContain("receipt");
  });

  it("numbers the links when a payment was split in two", () => {
    const email = buildPartialPaymentEmail({
      ...base,
      paidCentavos: 20000,
      owedCentavos: 29500,
      receiptUrls: [receiptUrl, `${receiptUrl}-2`],
    });
    expect(email.html).toContain("View your receipt 1");
    expect(email.html).toContain("View your receipt 2");
  });
});

describe("buildReceiptBacklogEmail", () => {
  it("apologises, links the receipt, and includes the QR when paid in full", () => {
    const email = buildReceiptBacklogEmail({
      ...base,
      qrUrl: "https://it2026.vercel.app/ticket/abc-123/qr",
      ticketCode: "A1B2C3D4E5F6",
      receiptUrls: [receiptUrl],
    });
    expect(email.subject.toLowerCase()).toContain("sorry");
    expect(email.html).toContain(receiptUrl);
    expect(email.html).toContain("<img");
    expect(email.text).toContain("A1B2-C3D4-E5F6");
  });

  it("skips the QR for a partial payment", () => {
    const email = buildReceiptBacklogEmail({ ...base, receiptUrls: [receiptUrl] });
    expect(email.html).not.toContain("<img");
    expect(email.html).toContain(receiptUrl);
  });

  it("escapes HTML-significant characters in the name", () => {
    const email = buildReceiptBacklogEmail({ ...base, fullName: "A & B <script>" });
    expect(email.html).not.toContain("<script>");
  });
});

describe("buildCertificateEmail", () => {
  it("links the certificate page and mentions the attachment", () => {
    const email = buildCertificateEmail(base);
    expect(email.subject.toLowerCase()).toContain("certificate");
    expect(email.html).toContain(base.url);
    expect(email.text.toLowerCase()).toContain("attached");
  });

  it("escapes HTML-significant characters in the name", () => {
    const email = buildCertificateEmail({
      ...base,
      fullName: "A & B <script>",
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("A &amp; B &lt;script&gt;");
  });
});
