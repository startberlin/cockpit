import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { UPLOAD_DIR } from "@/internal-apps/newsletter/lib/storage";

/**
 * Serves images stored by the `local` storage driver.
 *
 * Deliberately unauthenticated: these URLs are embedded in emails and fetched
 * by recipients' mail clients, which carry no session. The keys contain a random
 * segment, and the driver is only ever used in local development — production
 * points at Vercel Blob.
 */

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;

  const relative = path.join(...segments);
  const absolute = path.join(UPLOAD_DIR, relative);

  // Reject anything that escapes the upload directory — `..` segments in the
  // URL would otherwise read arbitrary files off the machine.
  const root = path.resolve(UPLOAD_DIR);
  if (!path.resolve(absolute).startsWith(`${root}${path.sep}`)) {
    return new Response("Not found", { status: 404 });
  }

  let size: number;
  try {
    const info = await stat(absolute);
    if (!info.isFile()) return new Response("Not found", { status: 404 });
    size = info.size;
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const contentType =
    CONTENT_TYPES[path.extname(absolute).toLowerCase()] ??
    "application/octet-stream";

  const stream = Readable.toWeb(createReadStream(absolute)) as ReadableStream;

  return new Response(stream, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
