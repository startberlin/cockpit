import assert from "node:assert/strict";
import { it } from "node:test";
import { isBlockEmpty } from "./block-summary";
import { createBlock } from "./blocks";

it("treats whitespace-only headings and unfinished links as empty", () => {
  assert.equal(
    isBlockEmpty({ id: "heading", kind: "heading", level: 2, text: "  \n " }),
    true,
  );
  assert.equal(
    isBlockEmpty({
      id: "button",
      kind: "button",
      label: "Read more",
      href: "  ",
      align: "left",
    }),
    true,
  );
  assert.equal(
    isBlockEmpty({
      id: "links",
      kind: "linkList",
      title: "News",
      items: [{ title: " ", url: " ", source: "", blurb: "" }],
    }),
    true,
  );
});

it("recognizes real body copy and image content", () => {
  assert.equal(
    isBlockEmpty({
      id: "body",
      kind: "text",
      body: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "News from Berlin" }],
          },
        ],
      },
    }),
    false,
  );
  assert.equal(
    isBlockEmpty({
      ...createBlock("hero", "hero"),
      kind: "hero",
      headline: "",
      eyebrow: "",
      subheadline: "",
      image: { url: "https://example.com/image.png", alt: "" },
    }),
    false,
  );
});
