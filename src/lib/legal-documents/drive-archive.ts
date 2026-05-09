import "server-only";
import { Readable } from "node:stream";
import { and, eq } from "drizzle-orm";
import { google } from "googleapis";
import db from "@/db";
import { legalDocument } from "@/db/schema/legal-document";
import { env } from "@/env";
import { createServiceAccountAuth } from "@/lib/google-auth";
import { newId } from "@/lib/id";
import { sha256Hex } from "./document-hash";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export async function archiveLegalDocument({
  legalMembershipId,
  documentType,
  buffer,
  fileName,
}: {
  legalMembershipId: string;
  documentType: string;
  buffer: Buffer;
  fileName: string;
}): Promise<{ driveFileId: string; driveUrl: string; sha256: string }> {
  // Check DB first — if a record already exists, skip the Drive upload entirely.
  // The UNIQUE(legal_membership_id, document_type) constraint is the authoritative
  // idempotency gate; this pre-flight avoids redundant Drive API calls on retries.
  const existing = await db.query.legalDocument.findFirst({
    where: (d, { and: andFn, eq: eqFn }) =>
      andFn(
        eqFn(d.legalMembershipId, legalMembershipId),
        eqFn(d.documentType, documentType),
      ),
    columns: { driveFileId: true, driveUrl: true, sha256: true },
  });
  if (existing) {
    return {
      driveFileId: existing.driveFileId,
      driveUrl: existing.driveUrl,
      sha256: existing.sha256,
    };
  }

  const sha256 = sha256Hex(buffer);

  const auth = createServiceAccountAuth(DRIVE_SCOPE);
  const drive = google.drive({ version: "v3", auth, timeout: 30_000 });

  const stream = Readable.from(buffer);

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [env.GOOGLE_DRIVE_LEGAL_DOCUMENTS_FOLDER_ID],
    },
    media: {
      mimeType: "application/pdf",
      body: stream,
    },
    fields: "id,webViewLink",
  });

  if (!response.data.id) {
    throw new Error("Drive upload did not return a file ID.");
  }

  const driveFileId = response.data.id;
  const driveUrl = response.data.webViewLink ?? "";

  await db
    .insert(legalDocument)
    .values({
      id: newId("legalDocument"),
      legalMembershipId,
      documentType,
      sha256,
      driveFileId,
      driveUrl,
      renderer: "react-pdf-v4",
    })
    .onConflictDoNothing();

  return { driveFileId, driveUrl, sha256 };
}

export async function hasArchivedDocument(
  legalMembershipId: string,
  documentType: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: legalDocument.id })
    .from(legalDocument)
    .where(
      and(
        eq(legalDocument.legalMembershipId, legalMembershipId),
        eq(legalDocument.documentType, documentType),
      ),
    );
  return rows.length > 0;
}
