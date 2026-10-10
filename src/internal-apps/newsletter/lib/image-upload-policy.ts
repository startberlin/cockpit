/** Leave room for multipart metadata below Vercel's 4.5 MB request limit. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const UPLOAD_SIZE_ERROR =
  "That image is larger than 4 MB after resizing.";

export const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

export function validateImageFile(file: File): void {
  if (!ALLOWED_CONTENT_TYPES.some((type) => type === file.type)) {
    throw new Error("Use a JPEG, PNG, GIF or WebP image.");
  }
  if (!file.size) throw new Error("That file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(UPLOAD_SIZE_ERROR);
}

/** Missing dimensions are allowed; malformed values must not become null. */
export function parseImageDimension(
  value: FormDataEntryValue | null,
): number | null {
  if (value === null || value === "") return null;
  const dimension = typeof value === "string" ? Number(value) : NaN;
  if (
    !Number.isInteger(dimension) ||
    dimension <= 0 ||
    dimension > 2_147_483_647
  ) {
    throw new Error("Image dimensions must be positive whole numbers.");
  }
  return dimension;
}
