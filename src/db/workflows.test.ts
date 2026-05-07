import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.DATABASE_URL ??= "postgres://user:password@localhost:5432/test";
process.env.BETTER_AUTH_SECRET ??= "test-secret";
process.env.GOOGLE_CLIENT_ID ??= "test-client-id";
process.env.GOOGLE_CLIENT_SECRET ??= "test-client-secret";
process.env.RESEND_API_KEY ??= "test-resend-key";
process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64 ??= "test-credentials";
process.env.SLACK_SIGNING_SECRET ??= "test-slack-secret";
process.env.NEXT_PUBLIC_COCKPIT_URL ??= "https://cockpit.example.com";

const now = new Date("2026-05-04T12:00:00.000Z");

async function workflowsModule() {
  return await import("./workflows");
}

describe("generic workflow values", () => {
  it("creates workflow rows with minimal relational fields", async () => {
    const { workflowValues } = await workflowsModule();

    const values = workflowValues({
      kind: "membership_payment_setup",
      subjectUserId: "usr_affected",
      createdByUserId: "usr_admin",
      metadata: {
        subjectUserId: "usr_affected",
        createdByUserId: "usr_admin",
        reason: "membership_payment_setup",
        billingApplies: true,
        step: "payment_required",
      },
      now,
    });

    assert.match(values.id, /^wfl_/);
    assert.equal(values.kind, "membership_payment_setup");
    assert.equal(values.status, "open");
    assert.equal(values.subjectUserId, "usr_affected");
    assert.equal(values.createdByUserId, "usr_admin");
    assert.equal(values.createdAt, now);
    assert.equal(values.completedAt, null);
    assert.equal(values.cancelledAt, null);
  });

  it("sets completedAt only for completed workflow values", async () => {
    const { workflowValues } = await workflowsModule();

    const values = workflowValues({
      kind: "membership_payment_setup",
      status: "completed",
      subjectUserId: "usr_affected",
      metadata: {
        subjectUserId: "usr_affected",
        createdByUserId: null,
        reason: "membership_payment_setup",
        billingApplies: true,
        step: "payment_required",
      },
      now,
    });

    assert.equal(values.completedAt, now);
    assert.equal(values.cancelledAt, null);
  });

  it("rejects metadata that does not match the workflow kind", async () => {
    const { workflowValues } = await workflowsModule();

    assert.throws(() =>
      workflowValues({
        kind: "membership_payment_setup",
        subjectUserId: "usr_affected",
        metadata: {
          subjectUserId: "usr_affected",
          step: "board_resolution",
        },
        now,
      }),
    );
  });
});
