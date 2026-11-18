import { createHash } from "node:crypto";
import { parse } from "tldts";
import { isSafePublicUrl } from "./contracts";

const MAX_BYTES = 64 * 1024;
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const pngEnd = Buffer.from("0000000049454e44ae426082", "hex");

export function companyIconHost(website: string): string | null {
  if (!isSafePublicUrl(website)) return null;
  const url = new URL(website);
  if (url.port) return null;
  const host = url.hostname
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^www\./, "");
  const parsed = parse(host, { allowPrivateDomains: true });
  if (
    (!parsed.isIcann && !parsed.isPrivate) ||
    !parsed.domain ||
    ["example.com", "example.net", "example.org"].includes(parsed.domain) ||
    host.endsWith(".arpa") ||
    host.endsWith(".onion")
  )
    return null;
  // Only send the registrable company domain, never a private subdomain.
  return parsed.domain;
}

export type CompanyIcon = { png: string; etag: string };

export async function fetchCompanyIcon(
  host: string,
  request = fetch,
): Promise<CompanyIcon | null> {
  if (companyIconHost(`https://${host}`) !== host) return null;
  const response = await request(
    `https://icon.horse/icon/${host}/64?fallback=404`,
    {
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      headers: { Accept: "image/png" },
      signal: AbortSignal.timeout(6000),
    },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Company icon provider unavailable");
  if (!response.body) return null;
  if (
    response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
      "image/png" ||
    response.headers.get("x-icon-fallback") === "true" ||
    Number(response.headers.get("content-length")) > MAX_BYTES
  ) {
    await response.body.cancel();
    return null;
  }
  const chunks: Uint8Array[] = [];
  const reader = response.body.getReader();
  let length = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > MAX_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const png = Buffer.concat(chunks, length);
  if (
    png.length < 45 ||
    !png.subarray(0, 8).equals(pngSignature) ||
    png.readUInt32BE(8) !== 13 ||
    png.toString("ascii", 12, 16) !== "IHDR" ||
    !png.subarray(-12).equals(pngEnd)
  )
    return null;
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  if (!width || !height || width > 64 || height > 64) return null;
  return {
    png: png.toString("base64"),
    etag: `"${createHash("sha256").update(png).digest("base64url")}"`,
  };
}

export async function companyFaviconResponse(
  request: Request,
  website: string | null,
  load: (host: string) => Promise<CompanyIcon | null>,
  cacheControl?: string,
) {
  const host = website && companyIconHost(website);
  const icon = host ? await load(host).catch(() => null) : null;
  if (!icon)
    return new Response(null, {
      status: 404,
      headers: {
        "Cache-Control": cacheControl ?? "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  const headers = {
    "Cache-Control": cacheControl ?? "private, max-age=3600",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "X-Content-Type-Options": "nosniff",
    "Content-Type": "image/png",
    ETag: icon.etag,
  };
  const tags = request.headers
    .get("if-none-match")
    ?.split(",")
    .map((tag) => tag.trim().replace(/^W\//, ""));
  if (tags?.includes("*") || tags?.includes(icon.etag))
    return new Response(null, { status: 304, headers });
  return new Response(Buffer.from(icon.png, "base64"), { headers });
}
