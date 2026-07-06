import "server-only";
import { Readable } from "node:stream";
import { google } from "googleapis";
import { env } from "@/env";
import { createServiceAccountAuth } from "@/lib/google-auth";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

async function getOrCreateUserFolder(
  drive: ReturnType<typeof google.drive>,
  firstName: string,
  lastName: string,
  legalMembershipId: string,
): Promise<string> {
  const rootFolderId = env.GOOGLE_DRIVE_LEGAL_DOCUMENTS_FOLDER_ID;
  if (!rootFolderId) {
    throw new Error(
      "GOOGLE_DRIVE_LEGAL_DOCUMENTS_FOLDER_ID is required to archive legal documents. It is optional only when DISABLE_GOOGLE_WORKSPACE is set.",
    );
  }

  const folderName = `${firstName} ${lastName} (${legalMembershipId})`.trim();
  const escapedName = folderName.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

  const existing = await drive.files.list({
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    q: `name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and '${rootFolderId}' in parents and trashed = false`,
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
      parents: [rootFolderId],
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
  buffer,
  fileName,
  firstName,
  lastName,
}: {
  legalMembershipId: string;
  buffer: Buffer;
  fileName: string;
  firstName: string;
  lastName: string;
}): Promise<{ driveFileId: string }> {
  const auth = createServiceAccountAuth(DRIVE_SCOPE);
  const drive = google.drive({ version: "v3", auth, timeout: 30_000 });

  const folderId = await getOrCreateUserFolder(
    drive,
    firstName,
    lastName,
    legalMembershipId,
  );

  // Search for an existing file with this name in the folder (idempotency).
  const escapedFileName = fileName.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const existing = await drive.files.list({
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    q: `name = '${escapedFileName}' and '${folderId}' in parents and trashed = false`,
    fields: "files(id)",
    pageSize: 1,
  });

  if (existing.data.files?.[0]?.id) {
    return { driveFileId: existing.data.files[0].id };
  }

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
    fields: "id",
  });

  if (!response.data.id) {
    throw new Error("Drive upload did not return a file ID.");
  }

  return { driveFileId: response.data.id };
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
