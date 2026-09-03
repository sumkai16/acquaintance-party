// Keep in sync with the @theme block in src/app/globals.css.
// Tailwind v4 needs these values at build time, so they live in both places.

/**
 * The visual identity, in one place.
 *
 * The party theme is confirmed as "Sunset Soiree" (2026-09-02) — the working
 * palette below was designed under the internal codename "Desert Sundown"
 * and needed no color changes, only the name. Any future theme change is
 * still an edit to this file, the @theme block in globals.css, and the
 * Google Fonts link in layout.tsx — nothing else. Components read these
 * tokens through Tailwind utilities and must never hardcode a hex value.
 */
export const THEME = {
  name: "Sunset Soiree",
  colors: {
    accent: "#C2481F", // burnt clay — primary actions, headlines
    accent2: "#E39824", // sun gold — highlights, poster title
    accent3: "#7E8B5F", // cactus sage — tertiary fills
    deep: "#3B2136", // dusk plum — hero ground, inverted sections
    ground: "#F2E3CB", // sand — page background
    ink: "#2E1D16", // body text
  },
  fonts: {
    display: '"Anton", "Archivo Black", sans-serif',
    body: '"DM Sans", "Segoe UI", sans-serif',
  },
} as const;
