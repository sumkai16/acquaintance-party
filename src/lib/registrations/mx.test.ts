import { describe, expect, it } from "vitest";
import { emailDomainProblem, type MailResolvers } from "./mx";

const dnsError = (code: string) => Object.assign(new Error(code), { code });

function resolvers(mx: () => Promise<unknown[]>, a: () => Promise<unknown[]>): MailResolvers {
  return { mx, a };
}

const never = () => Promise.reject(new Error("should not be called"));

describe("emailDomainProblem", () => {
  it("skips the lookup for a major provider", async () => {
    expect(await emailDomainProblem("juan@gmail.com", resolvers(never, never))).toBeNull();
  });

  it("passes a domain with an MX record", async () => {
    const r = resolvers(async () => [{ exchange: "mail.school.edu.ph" }], never);
    expect(await emailDomainProblem("juan@school.edu.ph", r)).toBeNull();
  });

  it("falls back to an A record when there is no MX", async () => {
    const r = resolvers(() => Promise.reject(dnsError("ENODATA")), async () => ["1.2.3.4"]);
    expect(await emailDomainProblem("juan@small.example", r)).toBeNull();
  });

  it("rejects a domain that does not exist", async () => {
    const r = resolvers(
      () => Promise.reject(dnsError("ENOTFOUND")),
      () => Promise.reject(dnsError("ENOTFOUND")),
    );
    expect(await emailDomainProblem("juan@notarealdomain.xyz", r)).toBe(
      "We couldn't find a mail server for @notarealdomain.xyz. Check the spelling.",
    );
  });

  it("lets the address through when DNS itself fails", async () => {
    const r = resolvers(() => Promise.reject(dnsError("ESERVFAIL")), never);
    expect(await emailDomainProblem("juan@school.edu.ph", r)).toBeNull();
  });
});
