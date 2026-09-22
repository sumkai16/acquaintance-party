import { getRegistration } from "@/lib/registrations/queries";
import { qrPngBuffer } from "@/lib/tickets/qr";

/**
 * The ticket QR as a hosted PNG, so the approval email can show the code
 * itself instead of only linking to the page that draws it.
 *
 * Approved-and-coded only: a pending or rejected registration has no QR to
 * hand out, and an email whose image resolves for a voided ticket would be
 * worse than one that shows nothing. No new exposure either way —
 * /ticket/<id> already renders this same code to anyone holding the id.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const registration = await getRegistration(id);
  if (!registration || registration.status !== "approved" || !registration.ticket_code) {
    return new Response("Not found", { status: 404 });
  }

  const png = await qrPngBuffer(registration.ticket_code);
  // ?download=1: the ticket page's "Save QR" button — a real file save
  // rather than a long-press-to-save, which not every phone offers on an
  // inline image the same way.
  const download = new URL(request.url).searchParams.has("download");

  return new Response(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      "content-disposition": `${download ? "attachment" : "inline"}; filename="ticket-qr.png"`,
      // Same no-store as the certificate image route. Gmail and friends
      // proxy-cache the image on their side regardless; what matters here is
      // that a voided ticket stops serving one from *our* side immediately.
      "cache-control": "no-store",
    },
  });
}
