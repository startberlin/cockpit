import {
  type CompletedSubmission,
  completedWebhookSubmission,
  tallyEventSchema,
  verifyTallySignature,
} from "./tally";

const MAX_BODY_BYTES = 1_048_576;

export function createReferralWebhookHandler({
  secret,
  ingest,
  reportError = console.error,
}: {
  secret: string | undefined;
  ingest: (submission: CompletedSubmission) => Promise<unknown>;
  reportError?: (error: unknown) => void;
}) {
  return async (request: Request): Promise<Response> => {
    if (!secret)
      return Response.json({ error: "Webhook unavailable" }, { status: 503 });
    if (!request.headers.get("tally-signature"))
      return Response.json({ error: "Invalid signature" }, { status: 401 });
    const reader = request.body?.getReader();
    if (!reader)
      return Response.json({ error: "Invalid body" }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > MAX_BODY_BYTES) {
          await reader.cancel();
          return Response.json({ error: "Body too large" }, { status: 413 });
        }
        chunks.push(chunk.value);
      }
    } catch {
      return Response.json({ error: "Invalid body" }, { status: 400 });
    } finally {
      reader.releaseLock();
    }
    let payload: unknown;
    try {
      payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (
      !verifyTallySignature(
        payload,
        request.headers.get("tally-signature"),
        secret,
      )
    ) {
      return Response.json({ error: "Invalid signature" }, { status: 401 });
    }
    const parsed = tallyEventSchema.safeParse(payload);
    if (!parsed.success)
      return Response.json({ error: "Invalid event" }, { status: 400 });
    const submission = completedWebhookSubmission(parsed.data);
    if (!submission) return Response.json({ status: "ignored" });
    try {
      await ingest(submission);
      return Response.json({ status: "received" });
    } catch (error) {
      reportError(error);
      return Response.json({ error: "Storage unavailable" }, { status: 503 });
    }
  };
}
