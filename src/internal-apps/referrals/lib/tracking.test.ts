import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { campaignConfigSchema } from "./campaign-config";
import { applicationUrl, referralUrl } from "./links";
import {
  completedWebhookSubmission,
  hiddenValue,
  tallyEventSchema,
  tallyWebhookSecret,
  verifyTallySignature,
} from "./tally";
import { createReferralWebhookHandler } from "./webhook-handler";

const secret = "test-signing-secret";
const code = "AbCdEfGhJkMnPqRs";
const event = {
  eventId: "event-1",
  eventType: "FORM_RESPONSE",
  data: {
    formId: "Me9Xlp",
    submissionId: "submission-1",
    createdAt: "2026-10-09T12:00:00Z",
    fields: [{ key: "question_ref", type: "HIDDEN_FIELDS", value: code }],
  },
};
const signature = (payload: unknown) =>
  createHmac("sha256", secret).update(JSON.stringify(payload)).digest("base64");
const request = (payload: unknown = event, signed = true) =>
  new Request("https://cockpit.test/api/tally/referrals", {
    method: "POST",
    headers: signed ? { "Tally-Signature": signature(payload) } : {},
    body: JSON.stringify(payload, null, 2),
  });

describe("referral tracking boundaries", () => {
  it("uses the existing API credential to derive a separate stable signing secret", async () => {
    const derived = tallyWebhookSecret("existing-api-key");
    assert.ok(derived);
    assert.notEqual(derived, "existing-api-key");
    assert.equal(derived, tallyWebhookSecret("existing-api-key"));
    assert.notEqual(derived, tallyWebhookSecret("rotated-api-key"));
    assert.equal(tallyWebhookSecret(undefined), undefined);
    assert.equal(
      tallyWebhookSecret("existing-api-key", "override"),
      "override",
    );
    let stored = false;
    const handler = createReferralWebhookHandler({
      secret: derived,
      ingest: async () => {
        stored = true;
      },
    });
    const signed = createHmac("sha256", derived)
      .update(JSON.stringify(event))
      .digest("base64");
    assert.equal(
      (
        await handler(
          new Request("https://cockpit.test", {
            method: "POST",
            body: JSON.stringify(event),
            headers: { "Tally-Signature": signed },
          }),
        )
      ).status,
      200,
    );
    assert.equal(stored, true);
  });
  it("creates a permanent code-only URL and replaces supplied attribution parameters", () => {
    assert.equal(
      referralUrl("https://cockpit.start-berlin.com", code),
      `https://cockpit.start-berlin.com/r/${code}`,
    );
    const url = new URL(
      applicationUrl(
        "https://apply.start-berlin.com/?ref=other&campaign=other&source=keep",
        code,
        "batch11-fall2026",
      ),
    );
    assert.equal(url.searchParams.get("ref"), code);
    assert.equal(url.searchParams.get("campaign"), "batch11-fall2026");
    assert.equal(url.searchParams.get("source"), "keep");
    assert.throws(() => referralUrl("https://cockpit.test", "../admin"));
  });
  it("accepts Tally's documented HMAC and rejects tampered, missing or malformed signatures", () => {
    assert.equal(verifyTallySignature(event, signature(event), secret), true);
    assert.equal(
      verifyTallySignature(
        { ...event, eventId: "changed" },
        signature(event),
        secret,
      ),
      false,
    );
    for (const invalid of [null, "", "invalid", "A".repeat(44)])
      assert.equal(verifyTallySignature(event, invalid, secret), false);
    assert.equal(verifyTallySignature(event, signature(event), ""), false);
  });
  it("only takes completed FORM_RESPONSE events", () => {
    assert.equal(
      completedWebhookSubmission(tallyEventSchema.parse(event))?.submissionId,
      "submission-1",
    );
    assert.equal(
      completedWebhookSubmission(
        tallyEventSchema.parse({ ...event, eventType: "FORM_PROGRESS" }),
      ),
      null,
    );
    assert.equal(
      completedWebhookSubmission(
        tallyEventSchema.parse({
          ...event,
          data: { ...event.data, isCompleted: false },
        }),
      ),
      null,
    );
    assert.equal(
      tallyEventSchema.safeParse({
        ...event,
        data: { ...event.data, createdAt: "invalid" },
      }).success,
      false,
    );
  });
  it("requires an exact, unambiguous hidden-field key", () => {
    assert.equal(hiddenValue(event.data.fields, "question_ref"), code);
    assert.equal(hiddenValue(event.data.fields, "other"), null);
    assert.equal(
      hiddenValue([...event.data.fields, ...event.data.fields], "question_ref"),
      undefined,
    );
    assert.equal(
      hiddenValue(
        [{ key: "question_ref", type: "INPUT_TEXT", value: code }],
        "question_ref",
      ),
      undefined,
    );
    assert.equal(
      hiddenValue(
        [{ key: "question_ref", type: "HIDDEN_FIELDS", value: 123 }],
        "question_ref",
      ),
      undefined,
    );
  });
  it("persists before acknowledging, including formatted JSON bodies", async () => {
    let persisted = false;
    const handler = createReferralWebhookHandler({
      secret,
      ingest: async (submission) => {
        assert.equal(
          submission.submittedAt.toISOString(),
          event.data.createdAt.replace("Z", ".000Z"),
        );
        persisted = true;
      },
    });
    assert.equal((await handler(request())).status, 200);
    assert.equal(persisted, true);
  });
  it("never calls storage for an unsigned or partial submission", async () => {
    const handler = createReferralWebhookHandler({
      secret,
      ingest: async () => assert.fail("Unexpected storage call"),
    });
    assert.equal((await handler(request(event, false))).status, 401);
    assert.equal(
      (
        await handler(
          request({ ...event, data: { ...event.data, isCompleted: false } }),
        )
      ).status,
      200,
    );
    assert.equal(
      (await handler(request({ ...event, eventType: "FORM_PROGRESS" }))).status,
      200,
    );
  });
  it("returns a retryable error when storage fails", async () => {
    const handler = createReferralWebhookHandler({
      secret,
      ingest: async () => {
        throw new Error("Unavailable");
      },
      reportError: () => {},
    });
    assert.equal((await handler(request())).status, 503);
    assert.equal(
      (
        await createReferralWebhookHandler({
          secret: undefined,
          ingest: async () => {},
        })(request())
      ).status,
      503,
    );
  });
  it("rejects malformed JSON, schema errors and oversized payloads", async () => {
    const handler = createReferralWebhookHandler({
      secret,
      ingest: async () => assert.fail("Unexpected storage call"),
    });
    assert.equal(
      (
        await handler(
          new Request("https://cockpit.test", {
            method: "POST",
            headers: { "tally-signature": "invalid" },
            body: "{",
          }),
        )
      ).status,
      400,
    );
    assert.equal((await handler(request({ bad: "payload" }))).status, 400);
    assert.equal(
      (
        await handler(
          new Request("https://cockpit.test", {
            method: "POST",
            headers: { "tally-signature": "invalid" },
            body: "x".repeat(1_048_577),
          }),
        )
      ).status,
      413,
    );
  });
  it("validates campaign windows across Berlin's daylight-saving change and rejects open redirects", () => {
    const config = {
      id: "batch11-fall2026",
      name: "Batch #11",
      batchNumber: 11,
      formId: "Me9Xlp",
      applicationUrl: "https://apply.start-berlin.com/",
      refFieldKey: "question_ref",
      campaignFieldKey: "question_campaign",
      opensAt: "2026-10-05T00:00:00+02:00",
      closesAt: "2026-10-27T00:00:00+01:00",
    };
    assert.equal(
      new Date(campaignConfigSchema.parse(config).closesAt).toISOString(),
      "2026-10-26T23:00:00.000Z",
    );
    assert.equal(
      campaignConfigSchema.safeParse({
        ...config,
        applicationUrl: "https://evil.test/",
      }).success,
      false,
    );
    assert.equal(
      campaignConfigSchema.safeParse({ ...config, closesAt: config.opensAt })
        .success,
      false,
    );
    assert.equal(
      campaignConfigSchema.safeParse({
        ...config,
        campaignFieldKey: config.refFieldKey,
      }).success,
      false,
    );
  });
});
