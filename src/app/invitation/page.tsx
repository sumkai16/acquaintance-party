import { cookies } from "next/headers";
import { Cinzel, EB_Garamond, Great_Vibes } from "next/font/google";
import { EVENT } from "@/lib/config/event";
import { ENTERED_COOKIE } from "@/lib/faculty/cookie";
import { LETTER } from "@/lib/faculty/letter";
import { InvitationForm } from "./invitation-form";
import { ProgramButton } from "./program-button";
import styles from "./letter.module.css";

/**
 * Three faces this one surface needs and no other page does — the script
 * title, the serif body, and the small-caps on the gold button. Loaded here
 * rather than in the root layout so every other route keeps paying for only
 * Anton and DM Sans. DM Sans stands in for the mockup's Inter, which is
 * close enough in the small-caps sizes it is used at to not be worth a
 * fourth download.
 */
const greatVibes = Great_Vibes({
  variable: "--font-great-vibes",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const ebGaramond = EB_Garamond({
  variable: "--font-eb-garamond",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["600"],
  display: "swap",
});

export const metadata = {
  title: "Letter of Invitation",
  description: `An invitation to the ${EVENT.name}, for the faculty.`,
};

// Reads a cookie and has no cached form — a stale copy of this page would
// show the form to someone already entered, or hide it from someone who
// isn't.
export const dynamic = "force-dynamic";

/**
 * The faculty letter of invitation, opened by scanning the shared QR.
 *
 * Public and unauthenticated: there is no per-person link and no session, so
 * the page identifies nobody. Acknowledging it is the entry, and the write
 * goes through a server action on the service-role client —
 * faculty_invitations has no RLS policy for any role. See
 * 0017_faculty_raffle.sql.
 *
 * Design 11a from the Landing page redesign mockups. The letter is a banner:
 * it unfurls when the link is opened and then drifts in the wind for as long
 * as it is on screen — see letter.module.css. This is the one public surface
 * that does not use the Sunset Soiree tokens; it carries the mockup's own
 * warm-paper palette, scoped to this route.
 */
export default async function InvitationPage() {
  const enteredAs = (await cookies()).get(ENTERED_COOKIE)?.value ?? null;

  return (
    <main
      className={`${greatVibes.variable} ${ebGaramond.variable} ${cinzel.variable} ${styles.page}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a full-bleed
          CSS-filtered backdrop, not content; next/image adds a wrapper that
          fights the object-fit here for no benefit at one fixed size. */}
      <img src="/landing-hero.jpg" alt="" aria-hidden className={styles.backdrop} />
      <div className={styles.wash} aria-hidden />

      <div className={styles.stage}>
        <article className={styles.letter}>
          <p className={styles.eyebrow}>{LETTER.eyebrow}</p>

          {/* Split on the newline rather than wrapping naturally: at 62px
              the script face has to break exactly where the mockup breaks
              it, or "Invitation" drops a letter onto its own line. */}
          <h1 className={styles.title}>
            {LETTER.title.split("\n").map((line) => (
              <span key={line} className={styles.titleLine}>
                {line}
              </span>
            ))}
          </h1>

          <hr className={styles.rule} />

          <p className={styles.overline}>{LETTER.overline}</p>
          <p className={styles.org}>{LETTER.org}</p>

          {LETTER.paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 40)} className={styles.body}>
              {paragraph}
            </p>
          ))}

          <p className={styles.when}>{LETTER.when}</p>
          <p className={styles.where}>{LETTER.where}</p>

          <hr className={styles.rule} />

          <ul className={styles.signatories}>
            {LETTER.signatories.map((signatory) => (
              <li key={signatory.name} className={styles.signatory}>
                <span className={styles.signatoryName}>{signatory.name}</span>
                <span className={styles.signatoryRole}>{signatory.role}</span>
              </li>
            ))}
          </ul>
        </article>

        {enteredAs ? (
          <div className={styles.entered} role="status">
            <p className={styles.enteredTitle}>You&apos;re on the list</p>
            <p className={styles.enteredBody}>
              Entered as {enteredAs}. Nothing else to do — we look forward to
              seeing you.
            </p>
          </div>
        ) : (
          <InvitationForm />
        )}

        <ProgramButton />
      </div>
    </main>
  );
}
