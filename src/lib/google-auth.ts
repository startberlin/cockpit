import { GoogleAuth } from "google-auth-library";
import { env } from "@/env";

const SUBJECT = "digital-connection-management@start-berlin.com";

/**
 * Decode base64 credentials and parse as JSON
 */
function getCredentials() {
  const base64 = env.GOOGLE_APPLICATION_CREDENTIALS_BASE64;
  if (!base64) {
    throw new Error(
      "GOOGLE_APPLICATION_CREDENTIALS_BASE64 is required to use Google APIs. It is optional only when DISABLE_GOOGLE_WORKSPACE is set.",
    );
  }
  const json = Buffer.from(base64, "base64").toString("utf-8");
  return JSON.parse(json);
}

/**
 * Create a GoogleAuth instance with decoded credentials from env.
 * Handles domain-wide delegation via the subject option.
 */
export function createGoogleAuth(scopes: string | string[]) {
  return new GoogleAuth({
    credentials: getCredentials(),
    scopes,
    clientOptions: { subject: SUBJECT },
  });
}

/**
 * Create a GoogleAuth instance that authenticates as the service account
 * itself — no domain-wide delegation. Use for Drive.file access where the
 * service account owns the files it creates.
 */
export function createServiceAccountAuth(scopes: string | string[]) {
  return new GoogleAuth({
    credentials: getCredentials(),
    scopes,
  });
}
