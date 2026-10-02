import { CROWD_CHOICE } from "@/lib/config/battle";
import { qrDataUrl } from "@/lib/tickets/qr";
import { projectorStatus } from "../actions";
import { VoteProjector } from "./vote-projector";

export const metadata = { title: `${CROWD_CHOICE.award} · Projector` };
export const dynamic = "force-dynamic";

const VOTE_PATH = "/vote";

/**
 * The screen the room sees (Stage Lights): a QR to vote, the running total,
 * then the band and solo winners, each shown when its own Reveal is pressed.
 * Admin-gated like every /admin page, because the poll behind it is — the
 * projector is just a laptop signed in as admin.
 */
export default async function VoteProjectorPage() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? null;
  const voteUrl = siteUrl ? `${siteUrl}${VOTE_PATH}` : null;
  // The ticket QR's own renderer: pure black on white with a quiet zone, which
  // is also what a phone camera wants across a room (context/DESIGN.md §4).
  const qr = voteUrl ? await qrDataUrl(voteUrl) : null;
  const initial = await projectorStatus();

  return (
    <VoteProjector
      qr={qr}
      voteUrl={voteUrl}
      initial={initial.ok ? initial.status : null}
    />
  );
}
