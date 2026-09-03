import { allDraws, eligiblePool } from "@/lib/raffle/queries";
import { approvedCount } from "@/lib/scans/queries";
import { RaffleProjector } from "./raffle-projector";

export const metadata = { title: "Raffle" };
// The pool grows as latecomers are scanned in; never serve a cached one to a
// room waiting on a draw.
export const dynamic = "force-dynamic";

export default async function RafflePage() {
  const [pool, draws, sold] = await Promise.all([
    eligiblePool(),
    allDraws(),
    approvedCount(),
  ]);

  return <RaffleProjector initialPool={pool} initialDraws={draws} ticketsSold={sold} />;
}
