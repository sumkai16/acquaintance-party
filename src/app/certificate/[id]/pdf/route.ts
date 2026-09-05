import { certificateFor } from "@/lib/certificates/data";
import { certificatePdf } from "@/lib/certificates/pdf";
import { certificateFilename, renderCertificatePng } from "@/lib/certificates/render";

/** The same certificate as a printable one-page PDF. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const data = await certificateFor(id);
  if (!data) return new Response("Not found", { status: 404 });

  const pdf = await certificatePdf(await renderCertificatePng(data));
  const filename = `${certificateFilename(data.fullName)}.pdf`;

  return new Response(pdf, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
