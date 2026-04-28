import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { verifyGoCardlessWebhook } from "../verify-request";
import {
  GoCardlessWebhookSchema,
  getGoCardlessEventUserHints,
  isMembershipActivationEvent,
  isMembershipFailureEvent,
  isMembershipMandateReadyEvent,
} from "./webhook";

describe("GoCardless webhook helpers", () => {
  it("verifies GoCardless webhook signatures against the raw body", () => {
    const body = JSON.stringify({ events: [] });
    const secret = "webhook-secret";
    const signature = createHmac("sha256", secret).update(body).digest("hex");

    assert.doesNotThrow(() =>
      verifyGoCardlessWebhook({ webhookSecret: secret, body, signature }),
    );
    assert.throws(() =>
      verifyGoCardlessWebhook({
        webhookSecret: secret,
        body,
        signature: "wrong",
      }),
    );
  });

  it("parses batched events", () => {
    const parsed = GoCardlessWebhookSchema.parse({
      events: [
        {
          id: "EV123",
          action: "customer_approval_granted",
          resource_type: "subscriptions",
          links: { subscription: "SB123" },
        },
      ],
    });

    assert.equal(parsed.events.length, 1);
  });

  it("identifies subscription activation and failure events", () => {
    assert.equal(
      isMembershipActivationEvent({
        id: "EV123",
        action: "customer_approval_granted",
        resource_type: "subscriptions",
        links: {},
      }),
      true,
    );
    assert.equal(
      isMembershipMandateReadyEvent({
        id: "EV125",
        action: "fulfilled",
        resource_type: "billing_requests",
        links: { mandate_request_mandate: "MD123" },
      }),
      true,
    );
    assert.equal(
      isMembershipFailureEvent({
        id: "EV124",
        action: "cancelled",
        resource_type: "subscriptions",
        links: {},
      }),
      true,
    );
  });

  it("extracts local user hints from metadata and links", () => {
    const hints = getGoCardlessEventUserHints({
      id: "EV123",
      action: "customer_approval_granted",
      resource_type: "subscriptions",
      links: {
        billing_request: "BRQ123",
        customer: "CU123",
        subscription: "SB123",
        mandate_request_mandate: "MD123",
      },
      metadata: {
        start_cockpit_user_id: "usr_123",
        start_cockpit_user_email: "member@example.com",
      },
    });

    assert.deepEqual(hints, {
      userId: "usr_123",
      userEmail: "member@example.com",
      billingRequestId: "BRQ123",
      customerId: "CU123",
      subscriptionId: "SB123",
      mandateId: "MD123",
    });
  });
});
