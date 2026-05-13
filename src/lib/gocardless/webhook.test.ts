import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { verifyGoCardlessWebhook } from "../verify-request";
import {
  GoCardlessWebhookSchema,
  getGoCardlessEventUserHints,
  getGoCardlessPaymentId,
  isMandateInvalidatedEvent,
  isMembershipActivationEvent,
  isMembershipFailureEvent,
  isMembershipMandateReadyEvent,
  isPaymentLifecycleEvent,
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

  it("identifies payment lifecycle events", () => {
    for (const action of [
      "submitted",
      "confirmed",
      "paid_out",
      "failed",
      "cancelled",
      "charged_back",
    ] as const) {
      assert.equal(
        isPaymentLifecycleEvent({
          id: "EV999",
          action,
          resource_type: "payments",
          links: { payment: "PM123" },
        }),
        true,
        `action=${action} should be a payment lifecycle event`,
      );
    }

    assert.equal(
      isPaymentLifecycleEvent({
        id: "EV999",
        action: "created",
        resource_type: "payments",
        links: {},
      }),
      false,
      "created is not a lifecycle event we handle",
    );

    assert.equal(
      isPaymentLifecycleEvent({
        id: "EV999",
        action: "submitted",
        resource_type: "subscriptions",
        links: {},
      }),
      false,
      "subscriptions resource_type is not a payment event",
    );
  });

  it("extracts GC payment ID from payment event links", () => {
    assert.equal(
      getGoCardlessPaymentId({
        id: "EV999",
        action: "confirmed",
        resource_type: "payments",
        links: { payment: "PM123" },
      }),
      "PM123",
    );

    assert.equal(
      getGoCardlessPaymentId({
        id: "EV999",
        action: "confirmed",
        resource_type: "payments",
        links: {},
      }),
      null,
    );
  });

  it("identifies mandate invalidating events", () => {
    for (const action of [
      "cancelled",
      "failed",
      "expired",
      "replaced",
      "consumed",
      "blocked",
    ] as const) {
      assert.equal(
        isMandateInvalidatedEvent({
          id: "EV200",
          action,
          resource_type: "mandates",
          links: { mandate: "MD123" },
        }),
        true,
        `mandates.${action} should be an invalidating event`,
      );
    }

    assert.equal(
      isMandateInvalidatedEvent({
        id: "EV201",
        action: "cancelled",
        resource_type: "payments",
        links: {},
      }),
      false,
      "payments.cancelled is not a mandate event",
    );
    assert.equal(
      isMandateInvalidatedEvent({
        id: "EV202",
        action: "active",
        resource_type: "mandates",
        links: {},
      }),
      false,
      "mandates.active does not invalidate the mandate",
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
