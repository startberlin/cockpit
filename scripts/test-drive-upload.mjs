#!/usr/bin/env node
/**
 * Standalone test: upload a small text file to the legal documents Drive folder.
 * Run with: node scripts/test-drive-upload.mjs
 *
 * Reads GOOGLE_APPLICATION_CREDENTIALS_BASE64 and GOOGLE_DRIVE_LEGAL_DOCUMENTS_FOLDER_ID from .env
 */

import { readFileSync } from "node:fs";
import { Readable } from "node:stream";
import { google } from "googleapis";
import { GoogleAuth } from "google-auth-library";

// --- load .env manually (no dotenv dependency needed) ---
const envPath = new URL("../.env", import.meta.url).pathname;
const envVars = Object.fromEntries(
  readFileSync(envPath, "utf-8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    }),
);

const credentialsBase64 = envVars.GOOGLE_APPLICATION_CREDENTIALS_BASE64;
const folderId = envVars.GOOGLE_DRIVE_LEGAL_DOCUMENTS_FOLDER_ID;

if (!credentialsBase64) {
  console.error("Missing GOOGLE_APPLICATION_CREDENTIALS_BASE64 in .env");
  process.exit(1);
}
if (!folderId) {
  console.error("Missing GOOGLE_DRIVE_LEGAL_DOCUMENTS_FOLDER_ID in .env");
  process.exit(1);
}

const credentials = JSON.parse(
  Buffer.from(credentialsBase64, "base64").toString("utf-8"),
);

console.log("Service account:", credentials.client_email);
console.log("Target folder:  ", folderId);
console.log("Scope:           https://www.googleapis.com/auth/drive");
console.log();

// Try 1: service account only (no impersonation)
// Try 2: domain-wide delegation (impersonating the admin user)
const SUBJECT = "digital-connection-management@start-berlin.com";

async function tryUpload(label, authOptions) {
  const auth = new GoogleAuth(authOptions);
  const drive = google.drive({ version: "v3", auth, timeout: 30_000 });

  console.log(`\n--- ${label} ---`);

  // Step 1: verify the folder is visible
  try {
    const folder = await drive.files.get({
      fileId: folderId,
      supportsAllDrives: true,
      fields: "id,name,mimeType",
    });
    console.log("Folder visible:", folder.data.name, `(${folder.data.mimeType})`);
  } catch (err) {
    console.error("Folder NOT visible:", err.message);
    return;
  }

  // Step 2: upload a file
  const fileName = `test-upload-${Date.now()}.txt`;
  const stream = Readable.from(Buffer.from(`Drive upload test at ${new Date().toISOString()}\n`));
  console.log(`Uploading "${fileName}" …`);

  try {
    const response = await drive.files.create({
      supportsAllDrives: true,
      requestBody: { name: fileName, parents: [folderId] },
      media: { mimeType: "text/plain", body: stream },
      fields: "id,webViewLink",
    });
    console.log("Upload success!");
    console.log("File ID:  ", response.data.id);
    console.log("View URL: ", response.data.webViewLink);
  } catch (err) {
    console.error("Upload failed:", err.message);
  }
}

// Attempt 1: service account as itself
await tryUpload("Service account (no impersonation)", {
  credentials,
  scopes: ["https://www.googleapis.com/auth/drive"],
});

// Attempt 2: domain-wide delegation via admin user
await tryUpload(`Domain-wide delegation as ${SUBJECT}`, {
  credentials,
  scopes: ["https://www.googleapis.com/auth/drive"],
  clientOptions: { subject: SUBJECT },
});
