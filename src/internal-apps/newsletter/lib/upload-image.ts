import type { ImageRef } from "./blocks";
import { prepareImage } from "./downscale";
import { UPLOAD_SIZE_ERROR, validateImageFile } from "./image-upload-policy";

export async function uploadNewsletterImage(
  file: File,
  { signal }: { signal?: AbortSignal } = {},
): Promise<ImageRef> {
  signal?.throwIfAborted();
  const prepared = await prepareImage(file);
  signal?.throwIfAborted();
  validateImageFile(prepared.file);
  const form = new FormData();
  form.set("file", prepared.file);
  form.set("width", String(prepared.width));
  form.set("height", String(prepared.height));
  form.set("alt", "");
  const response = await fetch("/api/newsletter/upload", {
    method: "POST",
    body: form,
    signal,
  });
  // A hosting proxy may return a plain-text error before our route is reached.
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      json?.error ??
        (response.status === 413 ? UPLOAD_SIZE_ERROR : "Image upload failed."),
    );
  }
  if (!json || typeof json.url !== "string")
    throw new Error("Image upload failed.");
  return {
    url: json.url,
    alt: "",
    width: json.width ?? prepared.width,
    height: json.height ?? prepared.height,
  };
}
