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
