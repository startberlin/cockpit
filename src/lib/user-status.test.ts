import assert from "node:assert/strict";
import { it } from "node:test";
import {
  DEFAULT_PEOPLE_STATUSES,
  directoryStatuses,
  getPeopleStatus,
  getPeopleStatusInfo,
} from "./user-status";

it("keeps member directory filters within the visible statuses", () => {
  assert.deepEqual(directoryStatuses(), DEFAULT_PEOPLE_STATUSES);
  assert.deepEqual(directoryStatuses(["paused", "cancelled"]), ["paused"]);
  assert.deepEqual(directoryStatuses(["alumni"]), []);
});

it("only overlays the Paused label on an operational member", () => {
  const timestamp = new Date("2026-11-17T12:00:00.000Z");
  assert.equal(getPeopleStatus("member", timestamp), "paused");
  assert.equal(getPeopleStatus("member", null), "member");
  assert.equal(getPeopleStatus("onboarding", timestamp), "onboarding");
  assert.equal(getPeopleStatus("alumni", timestamp), "alumni");
  assert.equal(getPeopleStatus("cancelled", timestamp), "cancelled");
  assert.equal(getPeopleStatusInfo("paused").label, "Paused");
});
