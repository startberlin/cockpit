import { GoogleAuth } from "google-auth-library";
import { env } from "@/env";

const SUBJECT = "digital-connection-management@start-berlin.com";

/**
 * Decode base64 credentials and parse as JSON
 */
function getCredentials() {
  const base64 = env.GOOGLE_APPLICATION_CREDENTIALS_BASE64;
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
