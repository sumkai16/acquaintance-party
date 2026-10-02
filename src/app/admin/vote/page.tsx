import Link from "next/link";
import { CROWD_CHOICE } from "@/lib/config/battle";
import { adminVoteStatus } from "./actions";
import { VotePanel } from "./vote-panel";

export const metadata = { title: CROWD_CHOICE.award };
export const dynamic = "force-dynamic";

/**
 * Control page for the Crowd's Choice vote: open and close voting, watch the
 * count, press Reveal. The count per act is shown here only — the projector
 * gets the winners after Reveal and nothing before it.
 */
export default async function AdminVotePage() {
  const result = await adminVoteStatus();

  return (
    <main className="mx-auto w-full max-w-5xl p-6 2xl:max-w-7xl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl uppercase">{CROWD_CHOICE.award}</h1>
          <p className="text-ground/60">
            Students vote at <code className="font-mono">/vote</code>: one band and one
            solo each, only if they were scanned in at the door.
          </p>
        </div>
        <Link
          href="/admin/vote/projector"
          className="rounded-full bg-accent-2 px-4 py-2 text-sm font-semibold text-deep hover:opacity-90 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
        >
          Open projector screen
        </Link>
      </header>

      {result.ok ? (
        <VotePanel initial={result.status} />
      ) : (
        <p role="alert" className="mt-6 rounded border border-red-400/40 bg-red-500/10 px-4 py-3 text-red-200">
          {result.error} If this is the first time, paste{" "}
          <code className="font-mono">supabase/migrations/0026_crowds_choice.sql</code>{" "}
          into Supabase.
        </p>
      )}
    </main>
  );
}
