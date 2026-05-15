import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.DATABASE_URL ??= "postgres://user:password@localhost:5432/test";
process.env.BETTER_AUTH_SECRET ??= "test-secret";
process.env.GOOGLE_CLIENT_ID ??= "test-client-id";
process.env.GOOGLE_CLIENT_SECRET ??= "test-client-secret";
process.env.AWS_REGION ??= "eu-central-1";
process.env.AWS_ACCESS_KEY_ID ??= "test-key-id";
process.env.AWS_SECRET_ACCESS_KEY ??= "test-secret-key";
process.env.AWS_SES_SNS_TOPIC_ARN ??=
  "arn:aws:sns:eu-central-1:123456789012:test-topic";
process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64 ??= "test-credentials";
process.env.SLACK_SIGNING_SECRET ??= "test-slack-secret";
process.env.NEXT_PUBLIC_COCKPIT_URL ??= "https://cockpit.example.com";
process.env.GOOGLE_DRIVE_LEGAL_DOCUMENTS_FOLDER_ID ??= "test-folder-id";

import type { StructuredMembershipState } from "@/lib/membership-status";
import { deriveMembershipHeroVariant } from "./membership-hero-state";

function state(
  overrides: Partial<
    Pick<StructuredMembershipState, "payment" | "mandateCancelled">
  > = {},
): Pick<StructuredMembershipState, "payment" | "mandateCancelled"> {
  return {
    payment: "not_started",
    mandateCancelled: false,
    ...overrides,
  };
}

describe("deriveMembershipHeroVariant", () => {
  it("AE1: admission_pending is opaque — renders onboarding copy", () => {
    assert.equal(
      deriveMembershipHeroVariant(state(), "admission_pending", "onboarding"),
      "onboarding",
    );
  });

  it("AE2: active + no customer id + no mandate → active_no_payment", () => {
    assert.equal(
      deriveMembershipHeroVariant(
        state({ payment: "not_started", mandateCancelled: false }),
        "active",
        "member",
      ),
      "active_no_payment",
    );
  });

  it("AE3: active + customer id set + no mandate (cancelled) → active_cancelled", () => {
    assert.equal(
      deriveMembershipHeroVariant(
        state({ payment: "not_started", mandateCancelled: true }),
        "active",
        "member",
      ),
      "active_cancelled",
    );
  });

  it("AE4: application_pending → application_pending", () => {
    assert.equal(
      deriveMembershipHeroVariant(state(), "application_pending", "onboarding"),
      "application_pending",
    );
  });

  it("AE5: active + member + mandate active → active_mandate_member", () => {
    assert.equal(
      deriveMembershipHeroVariant(
        state({ payment: "active" }),
        "active",
        "member",
      ),
      "active_mandate_member",
    );
  });

  it("AE6: alumni overrides all other signals", () => {
    assert.equal(
      deriveMembershipHeroVariant(
        state({ payment: "active" }),
        "active",
        "alumni",
      ),
      "alumni",
    );
    assert.equal(
      deriveMembershipHeroVariant(state(), null, "alumni"),
      "alumni",
    );
  });

  it("AE7: processing → processing", () => {
    assert.equal(
      deriveMembershipHeroVariant(state(), "processing", "onboarding"),
      "processing",
    );
  });

  it("row 3: supporting_alumni + mandate active → active_mandate_alumni", () => {
    assert.equal(
      deriveMembershipHeroVariant(
        state({ payment: "active" }),
        "active",
        "supporting_alumni",
      ),
      "active_mandate_alumni",
    );
  });

  it("row 7: manual_followup → manual_followup", () => {
    assert.equal(
      deriveMembershipHeroVariant(state(), "manual_followup", "onboarding"),
      "manual_followup",
    );
  });

  it("row 9: membership_reconfirmation_pending → membership_reconfirmation_pending", () => {
    assert.equal(
      deriveMembershipHeroVariant(
        state(),
        "membership_reconfirmation_pending",
        "member",
      ),
      "membership_reconfirmation_pending",
    );
  });

  it("row 10: cancelled non-alumni → cancelled", () => {
    assert.equal(
      deriveMembershipHeroVariant(state(), "cancelled", "member"),
      "cancelled",
    );
  });

  it("null legalMembershipStatus → onboarding", () => {
    assert.equal(
      deriveMembershipHeroVariant(state(), null, "onboarding"),
      "onboarding",
    );
  });
});
