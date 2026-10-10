import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import { customAlphabet } from "nanoid";
import { env } from "@/env";
import { validateImageFile } from "./image-upload-policy";

export { ALLOWED_CONTENT_TYPES, MAX_UPLOAD_BYTES } from "./image-upload-policy";

/**
 * Image storage for the newsletter, behind one interface with two drivers.
 *
 * `local` writes into a gitignored `.uploads/` directory and serves the files
 * back through a route handler. It exists so the whole app — including images —
 * works with nothing but a database, which matters because Vercel Blob's client
 * upload flow cannot complete locally: its `onUploadCompleted` callback is an
 * inbound webhook and never reaches a laptop without a tunnel.
 *
 * `blob` uses a plain server-side `put()` for the same reason. Newsletter images
 * are hero shots and logos, comfortably inside a request body, so the client
 * upload path buys nothing here and costs the local story.
 */

export type StorageDriver = "local" | "blob";

export const UPLOAD_DIR = path.join(process.cwd(), ".uploads");

const slug = customAlphabet("123456789abcdefghijkmnopqrstuvwxyz", 12);

export interface StoredAsset {
  url: string;
  pathname: string;
  driver: StorageDriver;
  filename: string;
  contentType: string;
  size: number;
}

export function currentDriver(): StorageDriver {
  if (env.NEWSLETTER_STORAGE === "blob") {
    if (!env.BLOB_READ_WRITE_TOKEN) {
      throw new Error(
        "BLOB_READ_WRITE_TOKEN is required for newsletter Blob storage.",
      );
    }
    return "blob";
  }
  return "local";
}

function safeFilename(name: string): string {
  const base = path.basename(name).replace(/[^\w.-]+/g, "-");
  return base.slice(-80) || "image";
}

export async function storeAsset(
  file: File,
  { baseUrl }: { baseUrl: string },
): Promise<StoredAsset> {
  validateImageFile(file);
  const driver = currentDriver();

  const filename = safeFilename(file.name);
  // The local route derives Content-Type from the key's extension. Canvas
  // conversion and files without extensions must still be served correctly.
  const extension = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
  }[file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp"];
  const storedFilename = `${filename.replace(/\.[^.]*$/, "")}${extension}`;
  const now = new Date();
  const key = `newsletter/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${slug()}-${storedFilename}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  if (driver === "blob") {
    const blob = await put(key, buffer, {
      access: "public",
      contentType: file.type,
      token: env.BLOB_READ_WRITE_TOKEN,
      // The key already carries a random segment; a second one would only make
      // the URL longer.
      addRandomSuffix: false,
    });

    return {
      url: blob.url,
      pathname: blob.pathname,
      driver,
      filename,
      contentType: file.type,
      size: buffer.byteLength,
    };
  }

  const target = path.join(UPLOAD_DIR, key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, buffer);

  return {
    // Absolute, because the same string is embedded in an email where a
    // relative path means nothing.
    url: `${baseUrl}/api/newsletter/assets/${key}`,
    pathname: key,
    driver,
    filename,
    contentType: file.type,
    size: buffer.byteLength,
  };
}
