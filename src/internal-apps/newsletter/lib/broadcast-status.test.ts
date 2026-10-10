import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { broadcastStatus } from "./broadcast-status";

describe("broadcast status reconciliation", () => {
  const now = Date.parse("2026-09-14T12:00:00Z");
  it("distinguishes queued delivery from a future schedule", () => {
    assert.equal(
      broadcastStatus("queued", "2026-09-15T12:00:00Z", now),
      "scheduled",
    );
    assert.equal(
      broadcastStatus("queued", "2026-09-13T12:00:00Z", now),
      "sending",
    );
    assert.equal(broadcastStatus("queued", null, now), "sending");
  });
  it("maps completion and both cancellation responses", () => {
    assert.equal(broadcastStatus("sent", null), "sent");
    assert.equal(broadcastStatus("draft", null), "canceled");
    assert.equal(broadcastStatus("canceled", null), "canceled");
  });
  it("does not guess when Resend introduces another status", () => {
    assert.equal(broadcastStatus("unknown", null), null);
  });
  it("keeps a recorded remote draft unresolved while dispatch is in flight", () => {
    assert.equal(broadcastStatus("draft", null, now, "sending"), null);
    assert.equal(broadcastStatus("draft", null, now, "scheduled"), "canceled");
    assert.equal(broadcastStatus("canceled", null, now, "sending"), "canceled");
  });
});
