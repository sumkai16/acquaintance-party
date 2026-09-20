import { allDraws, poolFor } from "@/lib/raffle/queries";
import { approvedCount } from "@/lib/scans/queries";
import type { RaffleAudience } from "@/lib/raffle/types";
import { RaffleProjector } from "./raffle-projector";

export const metadata = { title: "Raffle" };
// The pool grows as latecomers are scanned in; never serve a cached one to a
// room waiting on a draw.
export const dynamic = "force-dynamic";

export default async function RafflePage({
  searchParams,
}: {
  searchParams: Promise<{ audience?: string }>;
}) {
  const { audience: raw } = await searchParams;
  // URL-driven rather than component state, so a reload mid-programme — the
  // laptop sleeps, someone closes the tab — lands back on the same pool
  // instead of quietly reverting to students.
  const audience: RaffleAudience = raw === "faculty" ? "faculty" : "student";

  const [pool, draws, sold] = await Promise.all([
    poolFor(audience),
    allDraws(audience),
    approvedCount(),
  ]);

  return (
    <RaffleProjector
      // Remounts the whole show on a pool switch, so no draw, stage or
      // winner from the other audience can survive the change.
      key={audience}
      audience={audience}
      initialPool={pool}
      initialDraws={draws}
      ticketsSold={sold}
    />
  );
}
