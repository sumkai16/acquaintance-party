import { qrDataUrl } from "@/lib/tickets/qr";
import { QrScreen } from "./qr-screen";

export const metadata = { title: "Evaluation QR" };
export const dynamic = "force-dynamic";

const EVALUATE_PATH = "/evaluate";

/** The projector screen for the shared evaluation QR. Admin-gated like every /admin page. */
export default async function EvaluationQrPage() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? null;
  const url = siteUrl ? `${siteUrl}${EVALUATE_PATH}` : null;
  const qr = url ? await qrDataUrl(url) : null;

  return <QrScreen qr={qr} url={url} />;
}
