import { serverClient } from "@/lib/supabase/server";
import { approvedManifest } from "@/lib/scans/queries";

// The manifest lists every valid ticket code. Signed-in admins only — this is
// the one artifact that would let someone forge an entry.
export async function GET() {
  const { data } = await (await serverClient()).auth.getUser();
  if (!data.user) {
    return Response.json({ error: "Sign in again." }, { status: 401 });
  }

  try {
    return Response.json(await approvedManifest(), {
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Could not load the ticket manifest." },
      { status: 500 },
    );
  }
}
