import type { CSSProperties } from "react";

export function textAlignment(value: unknown): CSSProperties["textAlign"] {
  return value === "left" ||
    value === "center" ||
    value === "right" ||
    value === "justify"
    ? value
    : undefined;
}

export function textColor(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 80) return undefined;
  return /^(#[\da-f]{3,8}|(?:rgb|hsl)a?\([\d.%\s,/-]+\)|black|white|red|green|blue|gray|grey|orange|purple|yellow|transparent)$/i.test(
    value,
  )
    ? value
    : undefined;
}

/** Only email-safe typography is carried from a pasted fragment. Layout and
 * arbitrary CSS are never forwarded to the email renderer. */
export function inlineTextStyle(
  attrs: Record<string, unknown> = {},
): CSSProperties {
  const fontSize =
    typeof attrs.fontSize === "string" &&
    /^(?:\d{1,2}(?:\.\d+)?)(px|pt|em|rem)$/.test(attrs.fontSize)
      ? attrs.fontSize
      : undefined;
  const fontFamily =
    typeof attrs.fontFamily === "string" &&
    attrs.fontFamily.length < 150 &&
    /^[\w\s,'"-]+$/.test(attrs.fontFamily)
      ? attrs.fontFamily
      : undefined;
  const lineHeight =
    typeof attrs.lineHeight === "string" &&
    /^\d{1,2}(?:\.\d+)?(?:px|pt|em|rem|%)?$/.test(attrs.lineHeight)
      ? attrs.lineHeight
      : undefined;
  return {
    color: textColor(attrs.color),
    backgroundColor: textColor(attrs.backgroundColor),
    fontSize,
    fontFamily,
    lineHeight,
  };
}
