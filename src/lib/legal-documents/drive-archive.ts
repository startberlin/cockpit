import "server-only";
import { Readable } from "node:stream";
import { and, eq } from "drizzle-orm";
import { google } from "googleapis";
import db from "@/db";
import {
  type LegalDocumentType,
  legalDocument,
} from "@/db/schema/legal-document";
import { env } from "@/env";
import { createServiceAccountAuth } from "@/lib/google-auth";
import { newId } from "@/lib/id";
import { sha256Hex } from "./document-hash";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

async function getOrCreateUserFolder(
  drive: ReturnType<typeof google.drive>,
  firstName: string,
  lastName: string,
  legalMembershipId: string,
): Promise<string> {
  const folderName = `${firstName} ${lastName} (${legalMembershipId})`.trim();
  const escapedName = folderName.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

  const existing = await drive.files.list({
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    q: `name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and '${env.GOOGLE_DRIVE_LEGAL_DOCUMENTS_FOLDER_ID}' in parents and trashed = false`,
    fields: "files(id)",
    pageSize: 1,
  });

  if (existing.data.files?.[0]?.id) {
    return existing.data.files[0].id;
  }

  const folder = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [env.GOOGLE_DRIVE_LEGAL_DOCUMENTS_FOLDER_ID],
    },
    fields: "id",
  });

  if (!folder.data.id) {
    throw new Error(`Failed to create Drive folder for ${legalMembershipId}`);
  }

  return folder.data.id;
}

export async function archiveLegalDocument({
  legalMembershipId,
  documentType,
  buffer,
  fileName,
  firstName,
  lastName,
}: {
  legalMembershipId: string;
  documentType: LegalDocumentType;
  buffer: Buffer;
  fileName: string;
  firstName: string;
  lastName: string;
}): Promise<{ driveFileId: string; driveUrl: string; sha256: string }> {
  // Check DB first — if a record already exists, return it without uploading.
  // This handles the success-then-retry path (Drive uploaded and DB row committed).
  // In the failure-then-retry path (Drive succeeded but DB insert failed), the
  // pre-flight finds no row and a second Drive upload occurs; the DB constraint
  // prevents a duplicate row and the final SELECT below returns the stored values.
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

  const folderId = await getOrCreateUserFolder(
    drive,
    firstName,
    lastName,
    legalMembershipId,
  );

  const stream = Readable.from(buffer);

  const response = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: fileName,
      parents: [folderId],
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
    .onConflictDoNothing({
      target: [legalDocument.legalMembershipId, legalDocument.documentType],
    });

  // Return the authoritative DB row — may differ from the current upload's values
  // if a conflict occurred (a prior run uploaded but its DB insert failed, causing
  // a second Drive upload on this retry before the insert succeeded).
  const stored = await db.query.legalDocument.findFirst({
    where: (d, { and: andFn, eq: eqFn }) =>
      andFn(
        eqFn(d.legalMembershipId, legalMembershipId),
        eqFn(d.documentType, documentType),
      ),
    columns: { driveFileId: true, driveUrl: true, sha256: true },
  });

  if (!stored) {
    throw new Error(
      `legalDocument row missing after insert for ${legalMembershipId}/${documentType}`,
    );
  }

  return {
    driveFileId: stored.driveFileId,
    driveUrl: stored.driveUrl,
    sha256: stored.sha256,
  };
}

export async function hasArchivedDocument(
  legalMembershipId: string,
  documentType: LegalDocumentType,
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

export async function downloadArchivedDocument(
  driveFileId: string,
): Promise<Buffer> {
  const auth = createServiceAccountAuth(DRIVE_SCOPE);
  const drive = google.drive({ version: "v3", auth, timeout: 30_000 });
  const response = await drive.files.get(
    { fileId: driveFileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" },
  );
  return Buffer.from(response.data as ArrayBuffer);
}
