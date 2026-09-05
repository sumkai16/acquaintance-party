import { certificateFor } from "@/lib/certificates/data";
import { certificateFilename, renderCertificatePng } from "@/lib/certificates/render";

/**
 * The certificate as a PNG. `?download=1` makes the browser save it instead of
 * displaying it, so the page can use the same URL for both the preview and the
 * download button.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const data = await certificateFor(id);
  if (!data) return new Response("Not found", { status: 404 });

  const png = await renderCertificatePng(data);
  const download = new URL(request.url).searchParams.has("download");
  const filename = `${certificateFilename(data.fullName)}.png`;

  return new Response(png, {
    headers: {
      "content-type": "image/png",
      "content-disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
