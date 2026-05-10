import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sha256Hex } from "./document-hash";

describe("sha256Hex", () => {
  it("returns a 64-char lowercase hex string", () => {
    const result = sha256Hex(Buffer.from("hello"));
    assert.strictEqual(result.length, 64);
    assert.match(result, /^[0-9a-f]+$/);
  });

  it("is deterministic", () => {
    const buf = Buffer.from("test-content");
    assert.strictEqual(sha256Hex(buf), sha256Hex(buf));
  });

  it("produces different hashes for different inputs", () => {
    assert.notStrictEqual(
      sha256Hex(Buffer.from("a")),
      sha256Hex(Buffer.from("b")),
    );
  });

  it("matches known SHA-256 value", () => {
    // echo -n "abc" | sha256sum
    assert.strictEqual(
      sha256Hex(Buffer.from("abc")),
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad" as string,
    );
  });
});
