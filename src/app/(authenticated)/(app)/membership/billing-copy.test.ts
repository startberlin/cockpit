import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getMembershipBillingCopy,
  getMembershipToolsCopy,
} from "./billing-copy";

describe("getMembershipBillingCopy", () => {
  it("uses simple not_started copy for members", () => {
    const copy = getMembershipBillingCopy({
      mode: "not_started",
      userStatus: "member",
    });

    assert.equal(copy.title, "Set up your yearly membership payment");
    assert.match(copy.description, /40 EUR per year/);
  });

  it("shows active membership copy without pending actions", () => {
    const copy = getMembershipBillingCopy({ mode: "active" });

    assert.equal(copy.title, "Your membership is active");
    assert.match(copy.description, /yearly membership payment is set up/);
    assert.match(copy.description, /Thanks for being part/);
  });

  it("thanks supporting alumni for their support", () => {
    const copy = getMembershipBillingCopy({
      mode: "active",
      userStatus: "supporting_alumni",
    });

    assert.equal(copy.title, "Thanks for supporting START Berlin");
    assert.match(copy.description, /continuing to support the community/);
  });

  it("uses calm alumni copy without payment setup", () => {
    const copy = getMembershipBillingCopy({
      mode: "not_required",
      userStatus: "alumni",
    });

    assert.equal(copy.title, "You're listed as alumni");
    assert.match(copy.description, /No membership payment is needed/);
  });

  it("only uses onboarding welcome copy for onboarding users", () => {
    const copy = getMembershipBillingCopy({
      mode: "not_required",
      userStatus: "alumni",
    });

    assert.equal(copy.title, "You're listed as alumni");
    assert.doesNotMatch(copy.description, /onboarding phase/);
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
