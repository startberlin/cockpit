import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRevisionedSaveQueue, createSaveQueue } from "./save-queue";

describe("autosave ordering", () => {
  it("passes acknowledged revisions to the next queued edit", async () => {
    const first = Promise.withResolvers<string>();
    const revisions: string[] = [];
    const save = createRevisionedSaveQueue<string>(
      "initial",
      async (value, revision) => {
        revisions.push(revision);
        return value === "first" ? first.promise : "latest";
      },
    );
    const earlier = save("first");
    const later = save("second");
    await Promise.resolve();
    first.resolve("acknowledged");
    await Promise.all([earlier, later]);
    assert.deepEqual(revisions, ["initial", "acknowledged"]);
  });

  it("retains the acknowledged revision after a failed request", async () => {
    const revisions: string[] = [];
    const save = createRevisionedSaveQueue<string>(
      "initial",
      async (value, revision) => {
        revisions.push(revision);
        if (value === "offline") throw new Error("Offline");
        return "acknowledged";
      },
    );
    await assert.rejects(save("offline"), /Offline/);
    await save("retry");
    assert.deepEqual(revisions, ["initial", "initial"]);
  });

  it("never starts a newer write before an older write finishes", async () => {
    const first = Promise.withResolvers<void>();
    const calls: string[] = [];
    const save = createSaveQueue<string>(async (value) => {
      calls.push(`start ${value}`);
      if (value === "first") await first.promise;
      calls.push(`finish ${value}`);
    });
    const a = save("first");
    const b = save("latest");
    await Promise.resolve();
    assert.deepEqual(calls, ["start first"]);
    first.resolve();
    await Promise.all([a, b]);
    assert.deepEqual(calls, [
      "start first",
      "finish first",
      "start latest",
      "finish latest",
    ]);
  });
  it("reports a failed save and still lets the next edit persist", async () => {
    const values: string[] = [];
    const save = createSaveQueue<string>(async (value) => {
      if (value === "offline") throw new Error("Network failed");
      values.push(value);
    });
    const failed = save("offline");
    const retry = save("retry");
    await assert.rejects(failed, /Network failed/);
    await retry;
    assert.deepEqual(values, ["retry"]);
  });
});
