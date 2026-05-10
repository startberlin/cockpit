import { join } from "node:path";
import { Font } from "@react-pdf/renderer";

// ─── Design tokens (oklch → approx hex, matching global CSS) ─────────────────
export const C = {
  brand: "#0E1540", // oklch(0.1307 0.0905 264.05) – deep navy
  brandAccent: "#42B7C8", // oklch(0.7499 0.1301 211.57) – sky cyan
  ink: "#2C2620", // warm near-black
  inkSoft: "#504840", // warm dark grey
  inkMuted: "#8A8078", // warm medium grey
  rule: "#DAD4CE", // warm light rule
  ruleSoft: "#ECE9E5", // very light rule
  paperAlt: "#FAFAF8", // e-sig / integrity bg
  voteYesBg: "#E8F5EC",
  voteYesFg: "#2D6A42",
  voteNoBg: "#FBE9E7",
  voteNoFg: "#8B2E1A",
  white: "#FFFFFF",
} as const;

export const LOGO = join(process.cwd(), "public/logo-black.png");

export const ORG_LINES = [
  "Luisenstraße 53 · c/o HU-Gründerhaus · 10117 Berlin",
  "Vereinsregister VR 32262 B · Amtsgericht Charlottenburg, Berlin",
  "vorstand@startberlin.de · startberlin.de",
] as const;

export const ROLE_DISPLAY: Record<string, string> = {
  president: "President",
  vice_president: "Vice President",
  head_of_finance: "Head of Finance",
};

// ─── Layout constants ─────────────────────────────────────────────────────────
export const PAGE_STYLE = {
  fontFamily: "Avenir",
  backgroundColor: C.white,
} as const;

// Explicit A4 dimensions — gives Yoga a firm reference for all
// absolute children (BrandStripe, AccentSquare, DocFooter) and prevents the
// blank-page overflow bug that occurs when Page children use position:absolute.
export const WRAPPER = {
  width: "210mm",
  height: "297mm",
} as const;

// Content area: 18mm top, 22mm sides, 52mm bottom (20mm footer gap + 32mm zone)
export const CONTENT = {
  paddingTop: "18mm",
  paddingLeft: "22mm",
  paddingRight: "22mm",
  paddingBottom: "52mm",
} as const;

// ─── Font registration (executed once at module load) ─────────────────────────
Font.register({
  family: "Avenir",
  fonts: [
    {
      src: join(process.cwd(), "public/avenirnext-medium.otf"),
      fontWeight: 400,
    },
    { src: join(process.cwd(), "public/avenirnext-bold.otf"), fontWeight: 700 },
    {
      src: join(process.cwd(), "public/avenirnext-heavy.otf"),
      fontWeight: 900,
    },
  ],
});

Font.registerHyphenationCallback((word) => [word]);

// ─── Legacy export kept for any existing import sites ────────────────────────
export const BRAND = {
  name: "START Berlin e.V.",
  color: { primary: C.ink, secondary: C.inkMuted, border: C.rule },
  font: { regular: "Avenir", bold: "Avenir" },
};
