import { resolve4, resolveMx } from "node:dns/promises";
import { COMMON_EMAIL_DOMAINS } from "./schema";

const LOOKUP_TIMEOUT_MS = 3000;

// DNS answers that mean "this domain has no such records" — the only ones
// that prove an address can't receive mail. Anything else (timeout, SERVFAIL,
// no network) says nothing about the domain, so it must not block a student.
const DEFINITELY_MISSING = new Set(["ENOTFOUND", "ENODATA"]);

export type MailResolvers = {
  mx: (domain: string) => Promise<unknown[]>;
  a: (domain: string) => Promise<unknown[]>;
};

const dnsResolvers: MailResolvers = { mx: resolveMx, a: resolve4 };

function withTimeout<T>(work: Promise<T>): Promise<T> {
  return Promise.race([
    work,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("dns timeout")), LOOKUP_TIMEOUT_MS),
    ),
  ]);
}

async function hasRecords(lookup: Promise<unknown[]>): Promise<boolean | "unknown"> {
  try {
    return (await withTimeout(lookup)).length > 0;
  } catch (error) {
    const code = (error as { code?: string }).code;
    return code && DEFINITELY_MISSING.has(code) ? false : "unknown";
  }
}

/**
 * A message when the address's domain has no mail server, otherwise null.
 * Catches "juan@notarealdomain.xyz" — well-formed, so the schema passes it and
 * Resend accepts the send, but the ticket can never arrive. Cannot tell
 * whether the mailbox itself exists; nothing can without sending mail.
 * Fails open: a DNS hiccup returns null rather than blocking a real student.
 */
export async function emailDomainProblem(
  email: string,
  resolvers: MailResolvers = dnsResolvers,
): Promise<string | null> {
  const domain = email.slice(email.lastIndexOf("@") + 1).toLowerCase();
  if (!domain || COMMON_EMAIL_DOMAINS.includes(domain)) return null;

  const mx = await hasRecords(resolvers.mx(domain));
  if (mx !== false) return null;

  // No MX: mail standards fall back to the domain's own address record.
  const a = await hasRecords(resolvers.a(domain));
  if (a !== false) return null;

  return `We couldn't find a mail server for @${domain}. Check the spelling.`;
}
