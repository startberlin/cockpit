export const HTML_SIZE_WARNING_BYTES = 100_000;

const kilobyteFormat = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 3,
});
const byteFormat = new Intl.NumberFormat("en-GB");

export function isExactHtmlByteCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** Integer bytes convert exactly to decimal KB with at most three decimals. */
export function formatExactHtmlBytes(bytes: number): string {
  return `${kilobyteFormat.format(bytes / 1_000)} KB`;
}

export function describeExactHtmlBytes(bytes: number): string {
  return `${byteFormat.format(bytes)} bytes of UTF-8 HTML. 1 KB = 1,000 bytes. External image file bytes are excluded; image URLs and markup are included. Provider tracking links and recipient merge tags can change the final sent HTML.`;
}
