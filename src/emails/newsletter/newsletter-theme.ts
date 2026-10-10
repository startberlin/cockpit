/**
 * START Berlin brand tokens for the newsletter.
 *
 * Taken from the public website's stylesheet (`--dark-navy`, `--berlin-blue`,
 * `--rtss-red-2024`) rather than from Cockpit's UI palette. Cockpit's warm-stone
 * theme is the look of an internal tool; the newsletter is an outward-facing
 * editorial product and should read as START Berlin, not as a system mail.
 *
 * Plain hex only — email clients have no CSS custom properties, no oklch, and
 * no colour functions.
 */
export const brand = {
  navy: "#00002C",
  navySoft: "#011152",
  cyan: "#05C3DE",
  pink: "#FC2E72",

  ink: "#111322",
  inkSoft: "#3D4256",
  muted: "#6B7185",
  faint: "#9AA0B0",

  page: "#EEF1F5",
  surface: "#FFFFFF",
  surfaceAlt: "#F6F8FA",
  rule: "#E3E7ED",
  ruleStrong: "#C9D0DA",
  white: "#FFFFFF",
} as const;

/**
 * Avenir Next is self-hosted for Cockpit's UI; most mail clients ignore web
 * fonts entirely, so the fallback stack is what the majority of recipients
 * actually see and has to look deliberate on its own.
 */
export const FONT_STACK =
  '"Avenir Next", "Helvetica Neue", Helvetica, Arial, sans-serif';

export const CONTAINER_WIDTH = 600;
/** Horizontal padding inside the container, used by every block. */
export const GUTTER = 40;
