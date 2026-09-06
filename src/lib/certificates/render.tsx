import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { THEME } from "@/lib/config/theme";

/** A4 landscape at print resolution — the ratio a student's printer expects. */
export const CERTIFICATE_SIZE = { width: 2000, height: 1414 };

/**
 * The finished artwork, `public/certificate-bg.png` at 2000×1414 — the
 * school header, title, event details, quote, and signature lines are all
 * baked into it. The recipient's name is the one thing still composited at
 * request time, at NAME_TOP, over the blank underline the artwork already
 * has. Until the file exists the placeholder frame below stands in.
 */
const BACKGROUND_FILE = join(process.cwd(), "public", "certificate-bg.png");

/** First-pass estimate — nudge to sit just above the artwork's underline. */
const NAME_TOP = 655;

const { deep, accent2, ground, ink } = THEME.colors;

const fontDir = join(process.cwd(), "assets", "fonts");

/**
 * Read once at module scope, not per request — they never depend on the
 * registration being rendered. next/font's output isn't reachable from here,
 * so the same two families the site uses are committed under assets/fonts.
 */
const [anton, dmSans, dmSansBold, background] = await Promise.all([
  readFile(join(fontDir, "Anton-Regular.ttf")),
  readFile(join(fontDir, "DMSans-Regular.ttf")),
  readFile(join(fontDir, "DMSans-Bold.ttf")),
  readFile(BACKGROUND_FILE)
    .then((buffer) => `data:image/png;base64,${buffer.toString("base64")}`)
    // No artwork yet — the placeholder frame renders instead. Never fatal:
    // a missing decoration must not take the certificate down.
    .catch(() => null),
]);

const fonts = [
  { name: "Anton", data: anton, weight: 400 as const, style: "normal" as const },
  { name: "DM Sans", data: dmSans, weight: 400 as const, style: "normal" as const },
  { name: "DM Sans", data: dmSansBold, weight: 700 as const, style: "normal" as const },
];

export type CertificateData = {
  fullName: string;
  /** Not shown on the certificate artwork — kept for /verify/[code], which
   * looks a certificate up by yearLevel/section/serial independently of
   * however the printed design renders. */
  yearLevel: string;
  section: string;
  /** The registration's ticket code, doubling as the certificate serial. */
  serial: string;
};

/** A filesystem-safe name for the download, e.g. `certificate-juan-dela-cruz`. */
export function certificateFilename(fullName: string): string {
  const slug =
    fullName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "attendee";
  return `certificate-${slug}`;
}

export async function renderCertificatePng(
  data: CertificateData,
): Promise<Uint8Array<ArrayBuffer>> {
  const image = new ImageResponse(<Certificate data={data} />, {
    ...CERTIFICATE_SIZE,
    fonts,
  });

  return new Uint8Array(await image.arrayBuffer());
}

function Certificate({ data }: { data: CertificateData }) {
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: CERTIFICATE_SIZE.width,
        height: CERTIFICATE_SIZE.height,
        backgroundColor: ground,
        fontFamily: "DM Sans",
        color: ink,
      }}
    >
      {background ? (
        // next/image has no meaning inside an ImageResponse — satori rasterises
        // this element itself, and only understands a plain <img>.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={background}
          width={CERTIFICATE_SIZE.width}
          height={CERTIFICATE_SIZE.height}
          style={{ position: "absolute", top: 0, left: 0 }}
          alt=""
        />
      ) : (
        <PlaceholderFrame />
      )}

      <Row top={NAME_TOP}>
        <span
          style={{
            fontFamily: "Anton",
            fontSize: 120,
            lineHeight: 1,
            color: "#FFFFFF",
            textShadow: "0 3px 10px rgba(0,0,0,0.45)",
            textAlign: "center",
          }}
        >
          {data.fullName.toUpperCase()}
        </span>
      </Row>
    </div>
  );
}

/** One centred line, positioned from the top edge. */
function Row({ top, children }: { top: number; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 190,
        width: CERTIFICATE_SIZE.width - 380,
        display: "flex",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      {children}
    </div>
  );
}

/** Stand-in decoration until the real artwork lands in public/. */
function PlaceholderFrame() {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: CERTIFICATE_SIZE.width,
        height: CERTIFICATE_SIZE.height,
        display: "flex",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 60,
          width: CERTIFICATE_SIZE.width - 120,
          height: CERTIFICATE_SIZE.height - 120,
          border: `10px solid ${deep}`,
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 84,
          left: 84,
          width: CERTIFICATE_SIZE.width - 168,
          height: CERTIFICATE_SIZE.height - 168,
          border: `3px solid ${accent2}`,
          display: "flex",
        }}
      />
    </div>
  );
}
