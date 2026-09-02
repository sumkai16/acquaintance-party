import { after } from "next/server";
import { z } from "zod";
import { serverClient } from "@/lib/supabase/server";
import { recordScans } from "@/lib/scans/queries";
import { publishScans } from "@/lib/sheets/sheets";

const scanSchema = z.object({
  id: z.string().uuid(),
  registrationId: z.string().uuid().nullable(),
  codeScanned: z.string().min(1).max(64),
  scannedAt: z.string().datetime({ offset: true }),
  deviceLabel: z.string().min(1).max(40),
  result: z.enum(["ok", "duplicate", "invalid"]),
});

// One phone can bank a whole evening of scans during a blackout. Cap the batch
// so a single request stays well inside the body limit; the client chunks.
const batchSchema = z.object({ scans: z.array(scanSchema).max(200) });

export async function POST(request: Request) {
  const { data } = await (await serverClient()).auth.getUser();
  if (!data.user) {
    return Response.json({ error: "Sign in again." }, { status: 401 });
  }

  const parsed = batchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Malformed scan batch." }, { status: 400 });
  }

  const result = await recordScans(parsed.data.scans);
  if (!result.ok) return Response.json({ error: result.error }, { status: 500 });

  // After the response, never before it: the scanner polls this endpoint on a
  // 15s retry loop and must not wait on Google. `after` rather than a bare
  // unawaited call, which Vercel can kill once the response is sent.
  after(() => publishScans(result.inserted));

  return Response.json({ accepted: result.accepted });
}
