import assert from "node:assert/strict";
import { it } from "node:test";
import { type RichTextDoc, serializableRichText } from "./blocks";

it("normalizes ProseMirror list and link attributes without losing content", () => {
  const listAttrs = Object.assign(Object.create(null), { start: 3 });
  const linkAttrs = Object.assign(Object.create(null), {
    href: "https://example.com",
    target: "_blank",
    rel: "noopener noreferrer",
    class: null,
  });
  const doc: RichTextDoc = {
    type: "doc",
    content: [
      {
        type: "orderedList",
        attrs: listAttrs,
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: "Linked text",
                    marks: [
                      { type: "bold" },
                      { type: "link", attrs: linkAttrs },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  const normalized = serializableRichText(doc);
  assert.equal(
    Object.getPrototypeOf(normalized.content[0].attrs),
    Object.prototype,
  );
  const text = normalized.content[0].content?.[0].content?.[0].content?.[0];
  assert.equal(Object.getPrototypeOf(text?.marks?.[1].attrs), Object.prototype);
  assert.equal(text?.text, "Linked text");
  assert.equal(text?.marks?.[1].attrs?.href, "https://example.com");
  assert.equal(normalized.content[0].attrs?.start, 3);
  assert.equal(Object.getPrototypeOf(listAttrs), null);
});
