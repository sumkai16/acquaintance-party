import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { EVENT } from "@/lib/config/event";
import { THEME } from "@/lib/config/theme";
import { ANTON, CORMORANT, fitFontSize } from "./fit-text";

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

/**
 * Everything below is measured off `public/certificate-bg.png` itself, not
 * guessed: the name's underline is a 1123px rule at y=778, and the three
 * signature rules are 396px each at y=1286, centred on 511 / 1011 / 1512.
 *
 * Each is a *bottom* edge, not a top. Both the recipient's name and the
 * officers' names shrink to fit (see fitFontSize), and anchoring by the top
 * would leave a shrunk name floating above its rule by however much it shrank
 * — the taller the name, the closer it sat. Anchoring the bottom keeps every
 * name resting on its line at any size.
 */
const NAME_BOTTOM = 773;
const NAME_MAX_WIDTH = 1120;

const SIGNATORY_COLUMNS = [511, 1002, 1512];
const SIGNATORY_WIDTH = 396;
const SIGNATORY_BOTTOM = 1276;

/**
 * Warm cream, matched to the reference the organisers signed off on, and
 * close to the artwork's own "TREASURER" lettering so a composited name and
 * its printed role read as one block. An early attempt used the `ink` token,
 * which is nearly invisible here — this strip is the darkest part of the
 * background, not the lightest.
 */
const SIGNATORY_COLOR = "#F3E2B8";

/** Tracking, in px. A serif set in caps needs air to stop looking cramped. */
const SIGNATORY_TRACKING = 2;

const { deep, accent2, ground, ink } = THEME.colors;

const fontDir = join(process.cwd(), "assets", "fonts");

/**
 * Read once at module scope, not per request — they never depend on the
 * registration being rendered. next/font's output isn't reachable from here,
 * so the same two families the site uses are committed under assets/fonts.
 */
const [anton, dmSans, dmSansBold, cormorant, background] = await Promise.all([
  readFile(join(fontDir, "Anton-Regular.ttf")),
  readFile(join(fontDir, "DMSans-Regular.ttf")),
  readFile(join(fontDir, "DMSans-Bold.ttf")),
  readFile(join(fontDir, "Cormorant-Bold.ttf")),
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
  { name: "Cormorant", data: cormorant, weight: 700 as const, style: "normal" as const },
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
  const name = data.fullName.toUpperCase();
  const nameSize = fitFontSize(name, NAME_MAX_WIDTH, {
    max: 120,
    min: 44,
    profile: ANTON,
  });

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

      <Row top={NAME_BOTTOM - nameSize}>
        <span
          style={{
            fontFamily: "Anton",
            fontSize: nameSize,
            lineHeight: 1,
            color: "#FFFFFF",
            textShadow: "0 3px 10px rgba(0,0,0,0.45)",
            textAlign: "center",
            // Never wrap. If the width estimate is ever wrong the name
            // overhangs, which is obvious on sight; wrapping would look
            // almost right while sitting on top of the artwork's own text.
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </span>
      </Row>

      {EVENT.certificate.signatories.map((signatory, index) => (
        <Signature
          key={signatory.role}
          name={signatory.name}
          centerX={SIGNATORY_COLUMNS[index]}
        />
      ))}
    </div>
  );
}

/**
 * One officer's name, centred over its printed rule and resting on it.
 * Uppercase, because the role printed directly beneath it is — the pair has
 * to read as one block, not a name with a caption in a different voice.
 */
function Signature({ name: rawName, centerX }: { name: string; centerX: number }) {
  const name = rawName.toUpperCase();
  // A hair of padding either side, so a name that fills its column doesn't
  // touch the ends of the rule it sits on.
  const size = fitFontSize(name, SIGNATORY_WIDTH - 20, {
    max: 38,
    min: 20,
    profile: CORMORANT,
    letterSpacing: SIGNATORY_TRACKING,
  });

  return (
    <div
      style={{
        position: "absolute",
        top: SIGNATORY_BOTTOM - size,
        left: centerX - SIGNATORY_WIDTH / 2,
        width: SIGNATORY_WIDTH,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <span
        style={{
          fontFamily: "Cormorant",
          fontWeight: 700,
          fontSize: size,
          letterSpacing: SIGNATORY_TRACKING,
          lineHeight: 1,
          color: SIGNATORY_COLOR,
          // The strip behind these runs from near-black to bright gold, so
          // the fill alone can't carry every one of the three.
          textShadow: "0 2px 6px rgba(0,0,0,0.55)",
          whiteSpace: "nowrap",
        }}
      >
        {name}
      </span>
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
