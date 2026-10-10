/**
 * Client-side image preparation.
 *
 * Two reasons this happens in the browser rather than on the server: it keeps
 * the upload inside the request body limit without a streaming upload path, and
 * it means the intrinsic dimensions are known before the file is sent, so the
 * email can carry explicit `width`/`height` attributes. Mail clients have no
 * CSS aspect-ratio support, so an image without them reflows the layout as it
 * loads.
 */

/** Twice the 600px email container, so it stays sharp on retina displays. */
export const MAX_IMAGE_WIDTH = 1200;

export interface PreparedImage {
  file: File;
  width: number;
  height: number;
}

function readDimensions(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file could not be read as an image."));
    };
    img.src = url;
  });
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  // Re-encoding a GIF through a canvas would flatten it to a single frame.
  if (file.type === "image/gif") {
    const img = await readDimensions(file);
    return { file, width: img.naturalWidth, height: img.naturalHeight };
  }

  const img = await readDimensions(file);

  if (img.naturalWidth <= MAX_IMAGE_WIDTH) {
    return { file, width: img.naturalWidth, height: img.naturalHeight };
  }

  const width = MAX_IMAGE_WIDTH;
  const height = Math.max(
    1,
    Math.round((img.naturalHeight / img.naturalWidth) * width),
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { file, width: img.naturalWidth, height: img.naturalHeight };
  ctx.drawImage(img, 0, 0, width, height);

  // Keep the original format: re-encoding a logo's transparency onto a JPEG
  // background is a worse outcome than a slightly larger file.
  const type =
    file.type === "image/png" || file.type === "image/webp"
      ? file.type
      : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, 0.86),
  );
  if (!blob)
    return { file, width: img.naturalWidth, height: img.naturalHeight };

  return {
    file: new File([blob], file.name, { type: blob.type }),
    width,
    height,
  };
}
