import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const fieldSchema = z.object({
  key: z.string().min(1).max(256),
  type: z.string().min(1),
  value: z.unknown(),
});

export const tallyEventSchema = z.object({
  eventId: z.string().min(1).max(128),
  eventType: z.string(),
  data: z.object({
    formId: z.string().min(1).max(128),
    submissionId: z.string().min(1).max(128),
    createdAt: z.iso.datetime({ offset: true }),
    isCompleted: z.boolean().optional(),
    fields: z.array(fieldSchema).max(2000),
  }),
});
export type TallyEvent = z.infer<typeof tallyEventSchema>;
export type TallyField = z.infer<typeof fieldSchema>;

export function tallyWebhookSecret(
  apiKey: string | undefined,
  override?: string,
): string | undefined {
  if (override) return override;
  if (!apiKey) return undefined;
  // Domain separation keeps the API credential out of the webhook configuration.
  return createHmac("sha256", apiKey)
    .update("start-cockpit/referrals/webhook/v1")
    .digest("base64");
}

export interface CompletedSubmission {
  formId: string;
  submissionId: string;
  submittedAt: Date;
  fields: TallyField[];
}

// Tally signs JSON.stringify(payload), including when its HTTP body is formatted.
export function verifyTallySignature(
  payload: unknown,
  signature: string | null,
  secret: string,
): boolean {
  if (!secret || !signature || !/^[A-Za-z0-9+/]{43}=$/.test(signature))
    return false;
  const expected = createHmac("sha256", secret)
    .update(JSON.stringify(payload))
    .digest();
  const received = Buffer.from(signature, "base64");
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}

export function completedWebhookSubmission(
  event: TallyEvent,
): CompletedSubmission | null {
  if (event.eventType !== "FORM_RESPONSE" || event.data.isCompleted === false)
    return null;
  return {
    formId: event.data.formId,
    submissionId: event.data.submissionId,
    submittedAt: new Date(event.data.createdAt),
    fields: event.data.fields,
  };
}

export function hiddenValue(
  fields: TallyField[],
  key: string,
): string | null | undefined {
  const matching = fields.filter((field) => field.key === key);
  if (matching.length === 0) return null;
  if (matching.length !== 1 || matching[0].type !== "HIDDEN_FIELDS")
    return undefined;
  const value = matching[0].value;
  if (value === null || value === "") return null;
  return typeof value === "string" && value.length <= 256 ? value : undefined;
}
