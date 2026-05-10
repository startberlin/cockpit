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
      mode: "pending",
      paidThroughAt: new Date("2026-09-30T23:59:59.999Z"),
      now,
    });

    assert.equal(copy.title, "Set up your yearly membership payment");
    assert.match(copy.description, /covered through September 30, 2026/);
    assert.match(copy.description, /will not be charged before then/);
    assert.match(copy.paymentNote ?? "", /not be charged before/);
  });

  it("uses immediate payment setup copy without paid-through coverage", () => {
    const copy = getMembershipBillingCopy({
      mode: "pending",
      paidThroughAt: null,
      now,
    });

    assert.equal(copy.title, "Set up your yearly membership payment");
    assert.match(copy.description, /40 EUR per year/);
    assert.match(copy.description, /internal and external events/);
    assert.equal(copy.paymentNote, null);
  });

  it("does not promise delayed charging for expired coverage", () => {
    const copy = getMembershipBillingCopy({
      mode: "pending",
      paidThroughAt: new Date("2026-01-01T23:59:59.999Z"),
      now,
    });

    assert.doesNotMatch(copy.description, /covered through/);
    assert.doesNotMatch(copy.description, /not be charged before/);
    assert.equal(copy.paymentNote, null);
  });

  it("shows active membership copy without pending actions", () => {
    const copy = getMembershipBillingCopy({
      mode: "active",
      paidThroughAt: null,
      now,
    });

    assert.equal(copy.title, "Your membership is active");
    assert.match(copy.description, /yearly membership payment is set up/);
    assert.match(copy.description, /Thanks for being part/);
  });

  it("shows active membership paid-through context when available", () => {
    const copy = getMembershipBillingCopy({
      mode: "active",
      paidThroughAt: new Date("2026-09-30T23:59:59.999Z"),
      now,
    });

    assert.match(copy.description, /covered through September 30, 2026/);
    assert.match(copy.description, /yearly membership payment is set up/);
  });

  it("shows active title for member with future paid-through coverage", () => {
    const copy = getMembershipBillingCopy({
      mode: "active",
      userStatus: "member",
      paidThroughAt: new Date("2026-12-31T23:59:59.999Z"),
      now,
    });

    assert.match(copy.title, /active/);
    assert.match(copy.description, /covered through December 31, 2026/);
  });

  it("thanks supporting alumni for their support", () => {
    const copy = getMembershipBillingCopy({
      mode: "active",
      userStatus: "supporting_alumni",
      paidThroughAt: null,
      now,
    });

    assert.equal(copy.title, "Thanks for supporting START Berlin");
    assert.match(copy.description, /continuing to support the community/);
  });

  it("uses calm alumni copy without payment setup", () => {
    const copy = getMembershipBillingCopy({
      mode: "not_required",
      userStatus: "alumni",
      now,
    });

    assert.equal(copy.title, "You're listed as alumni");
    assert.match(copy.description, /No membership payment is needed/);
  });

  it("only uses onboarding welcome copy for onboarding users", () => {
    const copy = getMembershipBillingCopy({
      mode: "not_required",
      userStatus: "alumni",
      now,
    });

    assert.equal(copy.title, "You're listed as alumni");
    assert.doesNotMatch(copy.description, /onboarding phase/);
  });

  it("uses simple processing copy", () => {
    const copy = getMembershipBillingCopy({
      mode: "processing",
      now,
    });

    assert.equal(copy.title, "Finishing your membership setup");
    assert.match(copy.description, /updating your membership status/);
    assert.doesNotMatch(copy.description, /GoCardless/);
  });
});

describe("getMembershipToolsCopy", () => {
  it("uses onboarding tool wording for onboarding users", () => {
    assert.deepEqual(getMembershipToolsCopy("onboarding"), {
      visible: true,
      title: "Get connected",
      description:
        "Join the START Berlin workspaces where members coordinate, share resources, and work on projects.",
      actionLabel: "Join",
    });
  });

  it("uses workspace wording for members", () => {
    assert.deepEqual(getMembershipToolsCopy("member"), {
      visible: true,
      title: "Your START Berlin tools",
      description:
        "Open the workspaces you use for communication, projects, and resources.",
      actionLabel: "Open",
    });
  });

  it("uses workspace wording for supporting alumni", () => {
    assert.deepEqual(getMembershipToolsCopy("supporting_alumni"), {
      visible: true,
      title: "Your START Berlin tools",
      description:
        "Open the workspaces you use for communication, projects, and resources.",
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
