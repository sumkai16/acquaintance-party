import { describe, expect, it } from "vitest";
import {
  buildCertificateEmail,
  buildEvaluationInviteEmail,
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
