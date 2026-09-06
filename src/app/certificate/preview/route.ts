import { renderCertificatePng } from "@/lib/certificates/render";

/**
 * TEMPORARY, dev-only — lets the certificate design be checked in a browser
 * before any real registration has an evaluation to render from (the event
 * hasn't happened yet). Not part of the feature; remove once the design is
 * signed off. Try ?name=Some+Long+Name to test different lengths.
 */
export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get("name") || "Juan Dela Cruz";
  const png = await renderCertificatePng({
    fullName: name,
    yearLevel: "3rd year",
    section: "A",
    serial: "ABC12345",
  });
  return new Response(png, { headers: { "content-type": "image/png" } });
}
