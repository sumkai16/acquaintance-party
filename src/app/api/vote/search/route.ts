import type { NextRequest } from "next/server";
import { checkedInVoters } from "@/lib/votes/queries";
import { matchVoters, type VoterChoice } from "@/lib/votes/voters";

/**
 * The name search on /vote. Public — a student has no session — so it hands
 * out the least it can: a name, year level and section, never the ticket id
 * (that id is the secret link to someone's QR) and never the email (that is
 * the check). The list is anyone scanned in at the door, searchable by
 * design; the email is what stops someone voting as another person.
 *
 * The answer depends only on the query, so the CDN may serve the same
 * answer to every phone for 20 seconds. The voter list behind it is already
 * remembered for 30 (see checkedInVoters), which is the real shield for the
 * database; this stops the function being invoked at all for a repeat query.
 */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";

  try {
    const matches = matchVoters(await checkedInVoters(), query.slice(0, 80));
    const results: VoterChoice[] = matches.map((voter) => ({
      fullName: voter.fullName,
      yearLevel: voter.yearLevel,
      section: voter.section,
    }));
    return Response.json(
      { results },
      { headers: { "cache-control": "public, s-maxage=20, stale-while-revalidate=20" } },
    );
  } catch {
    return Response.json(
      { results: [], error: "Search is unavailable right now. Try again in a moment." },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
