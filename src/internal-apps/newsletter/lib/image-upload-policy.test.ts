import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_UPLOAD_BYTES,
  parseImageDimension,
  validateImageFile,
} from "./image-upload-policy";

describe("newsletter image upload limits", () => {
  it("rejects files too large for the server upload before making a request", () => {
    assert.throws(
      () =>
        validateImageFile(
          new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], "animation.gif", {
            type: "image/gif",
          }),
        ),
      /larger than 4 MB/,
    );
    assert.throws(
      () => validateImageFile(new File([], "empty.png", { type: "image/png" })),
      /empty/,
    );
    assert.throws(
      () =>
        validateImageFile(
          new File(["<svg/>"], "image.svg", { type: "image/svg+xml" }),
        ),
      /JPEG, PNG, GIF or WebP/,
    );
    validateImageFile(new File(["image"], "logo.webp", { type: "image/webp" }));
  });

  it("distinguishes absent dimensions from invalid multipart values", () => {
    assert.equal(parseImageDimension(null), null);
    assert.equal(parseImageDimension(""), null);
    assert.equal(parseImageDimension("1200"), 1200);
    for (const value of [
      "0",
      "-1",
      "NaN",
      "Infinity",
      "1.5",
      "2147483648",
      "abc",
      new File(["1"], "dimension"),
    ]) {
      assert.throws(() => parseImageDimension(value), /positive whole numbers/);
    }
  });
});
