import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { EVENT } from "@/lib/config/event";
import { THEME } from "@/lib/config/theme";
import { formatTicketCode } from "@/lib/tickets/code";
import { qrDataUrl } from "@/lib/tickets/qr";

/** A4 landscape at print resolution — the ratio a student's printer expects. */
export const CERTIFICATE_SIZE = { width: 2000, height: 1414 };

/**
 * Where the finished artwork goes.
 *
 * Drop the design in as `public/certificate-bg.png` at 2000×1414 (or larger,
 * same ratio) and it becomes the full-bleed background, with the name and
 * details composited on top at the offsets in LAYOUT below. Until then the
 * placeholder frame in this file stands in. Nudging those four numbers to fit
 * the artwork is the whole handover — nothing else moves.
 */
const BACKGROUND_FILE = join(process.cwd(), "public", "certificate-bg.png");

/** Vertical offsets from the top edge, in px. Tune these to the artwork. */
const LAYOUT = {
  heading: 190,
  name: 560,
  details: 830,
  footer: 1080,
};

const { accent, accent2, deep, ground, ink } = THEME.colors;

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
  yearLevel: string;
  section: string;
  /** The registration's ticket code, doubling as the certificate serial. */
  serial: string;
  /** Public page the QR points at. Null when the site URL isn't configured. */
  verifyUrl: string | null;
};

const eventDate = EVENT.startsAt.toLocaleDateString("en-PH", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

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
  const qr = data.verifyUrl ? await qrDataUrl(data.verifyUrl) : null;

  const image = new ImageResponse(<Certificate data={data} qr={qr} />, {
    ...CERTIFICATE_SIZE,
    fonts,
  });

  return new Uint8Array(await image.arrayBuffer());
}

function Certificate({
  data,
  qr,
}: {
  data: CertificateData;
  qr: string | null;
}) {
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

      <Row top={LAYOUT.heading}>
        <span
          style={{
            fontSize: 30,
            letterSpacing: 14,
            color: accent,
            fontWeight: 700,
          }}
        >
          {`${EVENT.host} presents`.toUpperCase()}
        </span>
      </Row>
      <Row top={LAYOUT.heading + 70}>
        <span style={{ fontFamily: "Anton", fontSize: 108, color: deep }}>
          CERTIFICATE OF ATTENDANCE
        </span>
      </Row>

      <Row top={LAYOUT.name - 80}>
        <span style={{ fontSize: 36, color: `${ink}` }}>
          This certifies that
        </span>
      </Row>
      <Row top={LAYOUT.name}>
        <span
          style={{
            fontFamily: "Anton",
            fontSize: 132,
            color: accent,
            textAlign: "center",
          }}
        >
          {data.fullName.toUpperCase()}
        </span>
      </Row>
      <Row top={LAYOUT.name + 165}>
        <span style={{ fontSize: 34, letterSpacing: 6, color: deep }}>
          {`${data.yearLevel} · Section ${data.section}`.toUpperCase()}
        </span>
      </Row>

      <Row top={LAYOUT.details}>
        <span style={{ fontSize: 38, textAlign: "center", lineHeight: 1.5 }}>
          {`attended ${EVENT.name}: ${EVENT.tagline}, held on`}
        </span>
      </Row>
      <Row top={LAYOUT.details + 62}>
        <span style={{ fontSize: 38, textAlign: "center", lineHeight: 1.5 }}>
          {`${eventDate} at ${EVENT.venue}.`}
        </span>
      </Row>

      <div
        style={{
          position: "absolute",
          top: LAYOUT.footer,
          left: 0,
          width: CERTIFICATE_SIZE.width,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          paddingLeft: 190,
          paddingRight: 190,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 26, letterSpacing: 6, color: `${ink}99` }}>
            CERTIFICATE NO.
          </span>
          <span style={{ fontSize: 40, letterSpacing: 8, fontWeight: 700 }}>
            {formatTicketCode(data.serial)}
          </span>
        </div>

        {qr ? (
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <span
              style={{
                fontSize: 24,
                color: `${ink}99`,
                width: 220,
                textAlign: "right",
                lineHeight: 1.4,
              }}
            >
              Scan to verify this certificate
            </span>
            {/* Black on white, no tint — the same camera constraint as the
                door ticket. See context/DESIGN.md §4. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} width={170} height={170} alt="" />
          </div>
        ) : null}
      </div>
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
