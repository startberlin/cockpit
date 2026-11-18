import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatActivityDescription,
  formatActivityTime,
} from "./activity-display";

const original = "2027-01-17T23:59:59.000Z";
const extended = "2027-04-30T23:59:59.000Z";

test("expiry history uses the Berlin calendar date and seasonal offset for each instant", () => {
  assert.equal(
    formatActivityDescription(
      "job.expiry_updated",
      `Changed expiry from ${original} to ${extended}.`,
    ),
    "Changed expiry from 18 Jan 2027, 00:59:59 CET to 1 May 2027, 01:59:59 CEST.",
  );
  assert.equal(
    formatActivityTime(new Date(extended)),
    "1 May 2027, 01:59:59 CEST",
  );
});

test("only system-generated timestamps in publication descriptions are formatted", () => {
  const note = `Review: Compare the original record at ${original}.\nApproved by the editor.`;
  assert.equal(
    formatActivityDescription(
      "job.published",
      `Approved a public version until ${extended}. ${note}`,
    ),
    `Approved a public version until 1 May 2027, 01:59:59 CEST. ${note}`,
  );
  const text = `Changed expiry from ${original} to ${extended}.`;
  assert.equal(formatActivityDescription("submission.rejected", text), text);
  assert.equal(
    formatActivityDescription("job.expiry_updated", "Legacy entry."),
    "Legacy entry.",
  );
});
