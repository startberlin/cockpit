import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createUploadTracker } from "./upload-tracker";

describe("newsletter upload tracking", () => {
  it("keeps independent native and template requests pending until each finishes", () => {
    const counts: number[] = [];
    const tracker = createUploadTracker((count) => counts.push(count));
    const native = tracker.begin("image");
    const template = tracker.begin("logo");
    assert.equal(tracker.isUploading("image"), true);
    native();
    native();
    assert.equal(tracker.isUploading("image"), false);
    assert.equal(tracker.isUploading("logo"), true);
    template();
    assert.deepEqual(counts, [1, 2, 1, 0]);
  });

  it("does not clear an image that still has another active request", () => {
    const tracker = createUploadTracker(() => {});
    const first = tracker.begin("image");
    const second = tracker.begin("image");
    first();
    assert.equal(tracker.isUploading("image"), true);
    second();
    assert.equal(tracker.isUploading("image"), false);
  });
});
