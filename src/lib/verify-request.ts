import { createHmac } from "node:crypto";
import tsscmp from "tsscmp";

const verifyErrorPrefix = "Failed to verify authenticity";

export interface GoCardlessWebhookVerificationOptions {
  webhookSecret: string;
  body: string;
  signature: string | null;
}

export function verifyGoCardlessWebhook(
  options: GoCardlessWebhookVerificationOptions,
): void {
  if (!options.signature) {
    throw new Error(`${verifyErrorPrefix}: missing Webhook-Signature header`);
  }

  const hmac = createHmac("sha256", options.webhookSecret);
  hmac.update(options.body);
  const expectedSignature = hmac.digest("hex");

  if (!tsscmp(options.signature, expectedSignature)) {
    throw new Error(`${verifyErrorPrefix}: GoCardless signature mismatch`);
  }
}

export function isValidGoCardlessWebhook(
  options: GoCardlessWebhookVerificationOptions,
): boolean {
  try {
    verifyGoCardlessWebhook(options);
    return true;
  } catch (e) {
    console.error(`Signature verification error: ${e}`);
  }
  return false;
}
