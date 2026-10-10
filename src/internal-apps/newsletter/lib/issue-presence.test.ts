import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createIssuePresenceActivity,
  createPresenceSessionIdentity,
  parseIssuePresenceResponse,
  presenceEditorLabel,
} from "./issue-presence";

describe("issue editor presence", () => {
  it("keeps a delayed departure separate from a resumed registration", () => {
    let nextId = 0;
    const identity = createPresenceSessionIdentity(
      () => `activation-${++nextId}`,
    );
    const firstRequestId = identity.activate();
    const delayedDepartureId = identity.release();
    const resumedRequestId = identity.activate();

    assert.equal(delayedDepartureId, firstRequestId);
    assert.notEqual(delayedDepartureId, resumedRequestId);
    assert.equal(identity.current(), resumedRequestId);
    assert.equal(identity.release(), resumedRequestId);
    assert.equal(identity.release(), null);
  });

  it("does not reuse registrations across effect setup and cleanup", () => {
    const firstEffect = createPresenceSessionIdentity();
    const firstRequestId = firstEffect.activate();
    assert.equal(firstEffect.release(), firstRequestId);

    const nextEffect = createPresenceSessionIdentity();
    assert.notEqual(nextEffect.activate(), firstRequestId);
  });

  it("does not mark a newly opened draft as changing", () => {
    const activity = createIssuePresenceActivity("initial draft");
    activity.observe("initial draft", 50_000);
    assert.equal(activity.isChanging(50_000), false);
  });

  it("expires activity while an unchanged dirty or conflicted draft stays open", () => {
    const activity = createIssuePresenceActivity("saved draft");
    activity.observe("local unsaved changes", 50_000);
    assert.equal(activity.isChanging(69_999), true);
    activity.observe("local unsaved changes", 69_999);
    assert.equal(activity.isChanging(70_000), false);
    activity.observe("another local edit", 70_001);
    assert.equal(activity.isChanging(70_001), true);
  });

  it("clears activity when a different issue is opened", () => {
    const activity = createIssuePresenceActivity("first issue");
    activity.observe("first issue changed", 50_000);
    activity.reset("second issue");
    assert.equal(activity.isChanging(50_001), false);
  });

  it("distinguishes this user's other tabs from another person", () => {
    const editor = {
      userId: "me",
      name: "Jannik",
      isChanging: true,
      sessionCount: 1,
    };
    assert.equal(presenceEditorLabel(editor, "me"), "You in another tab");
    assert.equal(
      presenceEditorLabel({ ...editor, sessionCount: 2 }, "me"),
      "You in 2 other tabs",
    );
    assert.equal(presenceEditorLabel(editor, "someone-else"), "Jannik");
  });

  it("rejects an invalid success payload instead of claiming no other editors", () => {
    assert.throws(() => parseIssuePresenceResponse({ editors: [] }));
    assert.throws(() =>
      parseIssuePresenceResponse({
        editors: [
          { userId: "me", name: "Jannik", isChanging: false, sessionCount: 0 },
        ],
        checkedAt: "2026-09-29T12:00:00Z",
      }),
    );
    assert.deepEqual(
      parseIssuePresenceResponse({
        editors: [],
        checkedAt: "2026-09-29T12:00:00Z",
      }),
      { editors: [], checkedAt: "2026-09-29T12:00:00Z" },
    );
  });
});
