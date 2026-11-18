import assert from "node:assert/strict";
import test from "node:test";
import { leavesCurrentDocument } from "./navigation-intent";

const current = "https://cockpit.example/jobboard/jobs/new";
const regular = { button: 0, modified: false, target: "", download: false };

test("leaving a dirty editor through a regular route link needs confirmation", () => {
  assert.equal(leavesCurrentDocument(current, "/jobboard/jobs", regular), true);
  assert.equal(
    leavesCurrentDocument(current, "https://example.com", regular),
    true,
  );
});

test("opening a new tab or downloading does not discard the current editor", () => {
  assert.equal(
    leavesCurrentDocument(current, "/jobboard/jobs", {
      ...regular,
      modified: true,
    }),
    false,
  );
  assert.equal(
    leavesCurrentDocument(current, "/jobboard/jobs", { ...regular, button: 1 }),
    false,
  );
  assert.equal(
    leavesCurrentDocument(current, "/jobboard/jobs", {
      ...regular,
      target: "_blank",
    }),
    false,
  );
  assert.equal(
    leavesCurrentDocument(current, "/jobboard/export", {
      ...regular,
      download: true,
    }),
    false,
  );
});

test("local section anchors and external handlers keep the editor open", () => {
  assert.equal(leavesCurrentDocument(current, "#compensation", regular), false);
  assert.equal(
    leavesCurrentDocument(current, "mailto:team@example.com", regular),
    false,
  );
  assert.equal(
    leavesCurrentDocument(current, "javascript:void(0)", regular),
    false,
  );
});
