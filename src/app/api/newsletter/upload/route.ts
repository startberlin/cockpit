import { NextResponse } from "next/server";
import db from "@/db";
import { getCurrentUser } from "@/db/user";
import { newsletterAsset } from "@/internal-apps/newsletter/db/schema";
import {
  parseImageDimension,
  UPLOAD_SIZE_ERROR,
} from "@/internal-apps/newsletter/lib/image-upload-policy";
import {
  MAX_UPLOAD_BYTES,
  storeAsset,
} from "@/internal-apps/newsletter/lib/storage";
import { newId } from "@/lib/id";
import { can } from "@/lib/permissions/server";

/**
 * Image upload for the newsletter composer.
 *
 * A route handler rather than a server action because the browser measures and
 * downscales the image first and posts a `File` — and because the asset row and
 * the stored bytes have to be written in the same request, so a half-finished
 * upload can never leave a database row pointing at nothing.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!(await can("apps.newsletter.access"))) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Send the image as multipart form data." },
      { status: 400 },
    );
  }
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file received." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: UPLOAD_SIZE_ERROR }, { status: 413 });
  }

  const alt = String(form.get("alt") ?? "");
  let width: number | null;
  let height: number | null;
  try {
    width = parseImageDimension(form.get("width"));
    height = parseImageDimension(form.get("height"));
  } catch {
    return NextResponse.json(
      { error: "Image dimensions must be positive whole numbers." },
      { status: 400 },
    );
  }

  const origin = new URL(request.url).origin;

  try {
    const stored = await storeAsset(file, { baseUrl: origin });

    const [row] = await db
      .insert(newsletterAsset)
      .values({
        id: newId("newsletterAsset"),
        url: stored.url,
        pathname: stored.pathname,
        driver: stored.driver,
        filename: stored.filename,
        contentType: stored.contentType,
        size: stored.size,
        width,
        height,
        alt,
        uploadedBy: user.id,
        createdAt: new Date(),
      })
      .returning();

    return NextResponse.json({
      id: row.id,
      url: row.url,
      alt: row.alt,
      width: row.width,
      height: row.height,
      filename: row.filename,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 400 },
    );
  }
}
