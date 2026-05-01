import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getMembershipBillingCopy,
  getMembershipToolsCopy,
} from "./billing-copy";

describe("getMembershipBillingCopy", () => {
  const now = new Date("2026-04-29T10:00:00.000Z");

  it("explains delayed charging for members with future paid-through coverage", () => {
    const copy = getMembershipBillingCopy({
      mode: "payment_pending",
      paidThroughAt: new Date("2026-09-30T23:59:59.999Z"),
      now,
    });

    assert.match(copy.description, /paid until September 30, 2026/);
    assert.match(copy.description, /only charge you after/);
    assert.match(copy.paymentNote ?? "", /not be charged before/);
  });

  it("uses immediate payment setup copy without paid-through coverage", () => {
    const copy = getMembershipBillingCopy({
      mode: "payment_pending",
      paidThroughAt: null,
      now,
    });

    assert.match(copy.description, /Set up your yearly membership billing/);
    assert.match(copy.description, /collected as soon as GoCardless confirms/);
    assert.equal(copy.paymentNote, null);
  });

  it("does not promise delayed charging for expired coverage", () => {
    const copy = getMembershipBillingCopy({
      mode: "payment_pending",
      paidThroughAt: new Date("2026-01-01T23:59:59.999Z"),
      now,
    });

    assert.doesNotMatch(copy.description, /paid until/);
    assert.doesNotMatch(copy.description, /only charge you after/);
    assert.equal(copy.paymentNote, null);
  });

  it("shows active membership copy without pending actions", () => {
    const copy = getMembershipBillingCopy({
      mode: "full_member",
      paidThroughAt: null,
      now,
    });

    assert.equal(copy.title, "Your membership is active.");
    assert.match(copy.description, /yearly membership billing is active/);
  });

  it("shows active membership paid-through context when available", () => {
    const copy = getMembershipBillingCopy({
      mode: "full_member",
      paidThroughAt: new Date("2026-09-30T23:59:59.999Z"),
      now,
    });

    assert.match(copy.description, /covered through September 30, 2026/);
  });

  it("only uses onboarding welcome copy for onboarding users", () => {
    const copy = getMembershipBillingCopy({
      mode: "profile_onboarding",
      userStatus: "alumni",
      now,
    });

    assert.equal(copy.title, "Your alumni status is active.");
    assert.doesNotMatch(copy.description, /onboarding phase/);
  });
});

describe("getMembershipToolsCopy", () => {
  it("uses onboarding tool wording for onboarding users", () => {
    assert.deepEqual(getMembershipToolsCopy("onboarding"), {
      visible: true,
      title: "First steps",
      description: "Set up your most important software accounts",
      actionLabel: "Join",
    });
  });

  it("uses software wording for members", () => {
    assert.deepEqual(getMembershipToolsCopy("member"), {
      visible: true,
      title: "Your software & tools",
      description: "Open the software accounts available to you",
      actionLabel: "Open",
    });
  });

  it("uses software wording for supporting alumni", () => {
    assert.deepEqual(getMembershipToolsCopy("supporting_alumni"), {
      visible: true,
      title: "Your software & tools",
      description: "Open the software accounts available to you",
      actionLabel: "Open",
    });
  });

  it("hides tools for alumni", () => {
    assert.deepEqual(getMembershipToolsCopy("alumni"), {
      visible: false,
      title: null,
      description: null,
      actionLabel: null,
    });
  });
});
