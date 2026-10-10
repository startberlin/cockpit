import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createIssueSchema,
  scheduleIssueSchema,
  sendTestSchema,
} from "./schemas";

const ISSUE_REVISION = {
  id: "issue",
  expectedUpdatedAt: "2026-09-29T12:00:00.000Z",
};

describe("newsletter send validation", () => {
  it("accepts immediate and future sends with explicit timezones", () => {
    for (const scheduledAt of [
      undefined,
      "",
      new Date(Date.now() + 3600000).toISOString(),
      "2099-10-01T09:00:00+02:00",
    ]) {
      assert.equal(
        scheduleIssueSchema.safeParse({ ...ISSUE_REVISION, scheduledAt })
          .success,
        true,
      );
    }
  });
  it("rejects past, invalid and timezone-free schedules before dispatch", () => {
    for (const scheduledAt of [
      "2020-01-01T09:00:00Z",
      "invalid",
      "2099-10-01T09:00",
      "2099-99-99T09:00:00Z",
    ]) {
      assert.equal(
        scheduleIssueSchema.safeParse({ ...ISSUE_REVISION, scheduledAt })
          .success,
        false,
      );
    }
  });
  it("validates sender and reply addresses", () => {
    for (const fromAddress of [
      "",
      "newsletter@example.com",
      "START Berlin <newsletter@example.com>",
    ]) {
      assert.equal(
        scheduleIssueSchema.safeParse({ ...ISSUE_REVISION, fromAddress })
          .success,
        true,
      );
    }
    for (const fromAddress of [
      "START Berlin",
      "<bad>",
      "Team\r\nBcc: other@example.com <newsletter@example.com>",
    ]) {
      assert.equal(
        scheduleIssueSchema.safeParse({ ...ISSUE_REVISION, fromAddress })
          .success,
        false,
      );
    }
    assert.equal(
      scheduleIssueSchema.safeParse({ ...ISSUE_REVISION, replyTo: "broken" })
        .success,
      false,
    );
  });
  it("rejects blank working names and trims valid names", () => {
    assert.equal(createIssueSchema.safeParse({ name: "   " }).success, false);
    assert.equal(
      createIssueSchema.parse({ name: "  October  " }).name,
      "October",
    );
  });
  it("accepts common recipient separators without accepting invalid addresses", () => {
    assert.deepEqual(
      sendTestSchema.parse({
        ...ISSUE_REVISION,
        recipients: "one@example.com; two@example.com,three@example.com",
      }).recipients,
      ["one@example.com", "two@example.com", "three@example.com"],
    );
    assert.equal(
      sendTestSchema.safeParse({ ...ISSUE_REVISION, recipients: "invalid" })
        .success,
      false,
    );
  });
  it("requires the acknowledged draft revision for dispatch", () => {
    assert.equal(scheduleIssueSchema.safeParse({ id: "issue" }).success, false);
    assert.equal(
      sendTestSchema.safeParse({ id: "issue", recipients: "one@example.com" })
        .success,
      false,
    );
  });
});
