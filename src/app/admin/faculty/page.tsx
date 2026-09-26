import Link from "next/link";
import { Table, Th, Tr } from "../table";
import { Stat } from "../stat";
import { listAcknowledgements } from "@/lib/faculty/queries";
import { LETTER_VERSION } from "@/lib/faculty/letter";
import { themedQrDataUrl } from "@/lib/tickets/themed-qr";
import { formatDateTimePH } from "@/lib/format/datetime";
import { DownloadQr } from "./download-qr";
import { RemoveEntry } from "./remove-entry";

export const metadata = { title: "Faculty" };
export const dynamic = "force-dynamic";

const INVITATION_PATH = "/invitation";

/**
 * The adviser's view of the faculty invitation: who has acknowledged the
 * letter, when, and the one shared QR that produced them.
 *
 * There is deliberately no "hasn't opened it yet" column, and there cannot
 * be one. A single shared QR means the app never learns who it was sent to,
 * so this is a list of who came forward, not a tick-off against a faculty
 * directory. Getting that would mean a QR per person, which needs the roster
 * up front — see the header of 0017_faculty_raffle.sql.
 */
export default async function FacultyPage() {
  const entries = await listAcknowledgements();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? null;
  const invitationUrl = siteUrl ? `${siteUrl}${INVITATION_PATH}` : null;
  // The themed one, not qr.ts's black-on-white: this code is printed on a
  // letter and scanned at leisure, unlike the ticket QR read at the door.
  const qr = invitationUrl ? themedQrDataUrl(invitationUrl) : null;

  // A stale wording is worth noticing: an entry recorded against an older
  // letter means that person agreed to something the current page no longer
  // says.
  const oldVersions = entries.filter(
    (entry) => entry.letter_version !== LETTER_VERSION,
  ).length;

  return (
    <main className="mx-auto w-full max-w-5xl p-6 2xl:max-w-7xl">
      <header>
        <h1 className="font-display text-3xl uppercase">Faculty</h1>
        <p className="text-ground/60">
          Everyone who has read the letter of invitation and entered the faculty
          giveaway. Draw from this list on{" "}
          <Link
            href="/admin/raffle?audience=faculty"
            className="underline hover:text-ground"
          >
            Raffle → Faculty
          </Link>
          .
        </p>
      </header>

      <dl className="mt-6 grid grid-cols-2 gap-3">
        <Stat label="Acknowledged" value={entries.length} />
        <Stat label="On an older letter" value={oldVersions} />
      </dl>

      <section className="mt-8 flex flex-col gap-4 rounded-lg border border-ground/10 bg-ground/5 p-4 sm:flex-row sm:items-start">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element -- a data URL, nothing for next/image to optimise
          <img
            src={qr}
            alt={`QR code linking to ${invitationUrl}`}
            className="h-44 w-44 shrink-0 rounded-md"
          />
        ) : null}

        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">The invitation QR</h2>
          {invitationUrl ? (
            <>
              <p className="text-sm text-ground/70">
                One QR for every faculty member — put it on the letter, or send
                it in a group chat.
              </p>
              {qr ? (
                <DownloadQr svgDataUrl={qr} filename="faculty-invitation-qr.png" />
              ) : null}
              <p className="break-all rounded border border-ground/15 bg-black/20 px-3 py-2 font-mono text-sm">
                {invitationUrl}
              </p>
              <p className="text-sm text-ground/50">
                Anyone with this link can add a name, so one person can enter
                twice under two spellings. The same name is refused
                automatically; remove anything else below.
              </p>
            </>
          ) : (
            <p className="text-sm text-ground/70">
              Set <code className="font-mono">NEXT_PUBLIC_SITE_URL</code> in
              Vercel and redeploy to generate the QR. The page itself already
              works at <code className="font-mono">{INVITATION_PATH}</code>.
            </p>
          )}
        </div>
      </section>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Acknowledgements</h2>
      </div>

      <div className="mt-2">
        <Table
          empty={
            entries.length === 0
              ? "Nobody has opened the invitation yet."
              : undefined
          }
        >
          <thead>
            <tr className="text-left">
              <Th>Name</Th>
              <Th>Department</Th>
              <Th>Acknowledged</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <Tr key={entry.id}>
                <td className="py-2 pr-3 pl-4 font-medium">{entry.full_name}</td>
                <td className="py-2 pr-3 text-ground/70">
                  {entry.department ?? "—"}
                </td>
                <td className="py-2 pr-3 text-ground/70">
                  {formatDateTimePH(entry.acknowledged_at)}
                  {entry.letter_version !== LETTER_VERSION ? (
                    <span className="block text-ground/50">
                      on letter {entry.letter_version}
                    </span>
                  ) : null}
                </td>
                <td className="py-2 pr-3 pl-3">
                  <RemoveEntry id={entry.id} fullName={entry.full_name} />
                </td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>
    </main>
  );
}
