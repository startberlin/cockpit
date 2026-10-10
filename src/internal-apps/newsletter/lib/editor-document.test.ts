import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type Block, blocksSchema, type RichTextDoc } from "./blocks";
import {
  blocksToDocument,
  documentPlainText,
  documentText,
  documentToBlocks,
  expandBlock,
  looksLikeMarkdown,
  safeUrl,
} from "./editor-document";
import { sampleBlocks } from "./sample-issue";

describe("continuous newsletter document", () => {
  it("exports readable paragraphs, numbered lists and template destinations", () => {
    const text = documentPlainText({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Opening" }] },
        {
          type: "orderedList",
          attrs: { start: 3 },
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "First" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Second" }],
                },
              ],
            },
          ],
        },
        {
          type: "newsletterBlock",
          attrs: {
            block: {
              id: "button",
              kind: "button",
              label: "Read more",
              href: "https://example.com/story",
              align: "left",
            },
          },
        },
      ],
    });
    assert.equal(
      text,
      "Opening\n\n3. First\n4. Second\n\nRead more (https://example.com/story)",
    );
  });

  it("counts both sides of a hard line break as separate words", () => {
    assert.equal(
      documentText({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Hello" },
              { type: "hardBreak" },
              { type: "text", text: "Berlin" },
            ],
          },
        ],
      }),
      "Hello Berlin",
    );
  });

  it("round-trips every existing template without changing its content", () => {
    const blocks = sampleBlocks("https://example.com");
    assert.deepEqual(documentToBlocks(blocksToDocument(blocks)), blocks);
  });

  it("keeps standalone headings, linked images and dividers", () => {
    const blocks: Block[] = [
      { id: "heading", kind: "heading", level: 3, text: "Gründer in Berlin" },
      {
        id: "image",
        kind: "image",
        image: {
          url: "https://example.com/photo.png",
          alt: "Gründerteam",
          width: 1200,
          height: 600,
        },
        caption: "Our team",
        href: "https://example.com/team",
      },
      { id: "divider", kind: "divider" },
    ];
    assert.deepEqual(documentToBlocks(blocksToDocument(blocks)), blocks);
  });

  it("saves native headings with inline formatting without flattening the marks", () => {
    const doc: RichTextDoc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: {
            sourceId: "heading",
            sourceKind: "heading",
            level: 2,
            textAlign: "center",
          },
          content: [
            { type: "text", text: "A headline", marks: [{ type: "italic" }] },
          ],
        },
      ],
    };
    const result = documentToBlocks(doc);
    assert.equal(result[0].kind, "text");
    if (result[0].kind !== "text") throw Error("Expected rich text");
    assert.equal(result[0].body.content[0].attrs?.textAlign, "center");
    assert.equal(
      result[0].body.content[0].content?.[0].marks?.[0].type,
      "italic",
    );
    assert.equal(result[0].body.content[0].attrs?.sourceId, undefined);
  });

  it("retains a legacy heading changed to a title after saving and reopening", () => {
    const doc = blocksToDocument([
      { id: "heading", kind: "heading", level: 2, text: "Gründer in Berlin" },
    ]);
    doc.content[0].attrs = { ...doc.content[0].attrs, level: 1 };

    const saved = documentToBlocks(doc);
    assert.ok(blocksSchema.safeParse(saved).success);
    const reopened = blocksToDocument(saved);
    assert.equal(reopened.content[0].attrs?.level, 1);
    assert.equal(documentText(reopened), "Gründer in Berlin");
  });

  it("mints different IDs when pasted template IDs are duplicated", () => {
    const block: Block = {
      id: "button",
      kind: "button",
      label: "Read",
      href: "https://example.com",
      align: "left",
    };
    const doc: RichTextDoc = {
      type: "doc",
      content: [
        { type: "newsletterBlock", attrs: { block } },
        { type: "newsletterBlock", attrs: { block } },
      ],
    };
    const result = documentToBlocks(doc, () => "new-button");
    assert.deepEqual(
      result.map((item) => item.id),
      ["button", "new-button"],
    );
    assert.ok(blocksSchema.safeParse(result).success);
  });

  it("retains blank lines inside text and ignores the trailing cursor paragraph", () => {
    const block: Block = {
      id: "text",
      kind: "text",
      body: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Before" }] },
          { type: "paragraph" },
          { type: "paragraph", content: [{ type: "text", text: "After" }] },
        ],
      },
    };
    assert.deepEqual(documentToBlocks(blocksToDocument([block])), [block]);
    assert.deepEqual(documentToBlocks(blocksToDocument([])), []);
  });

  it("does not leak non-serializable attributes to Server Actions", () => {
    const attrs = Object.assign(Object.create(null), {
      sourceId: "text",
      textAlign: "center",
    });
    const blocks = documentToBlocks({
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs,
          content: [{ type: "text", text: "Hello" }],
        },
      ],
    });
    assert.equal(Object.getPrototypeOf(blocks[0]), Object.prototype);
    assert.ok(blocksSchema.safeParse(blocks).success);
  });

  it("rejects executable and transient image URLs", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "blob:https://example.com/local",
      "file:///private/file",
    ])
      assert.equal(safeUrl(url, true), "");
    assert.equal(
      safeUrl("https://example.com/image.jpg", true),
      "https://example.com/image.jpg",
    );
    assert.equal(
      safeUrl("mailto:hello@example.com"),
      "mailto:hello@example.com",
    );
  });

  it("expands all template text for export, including links and quotes", () => {
    const doc = {
      type: "doc" as const,
      content: sampleBlocks("https://example.com").flatMap(expandBlock),
    };
    const text = documentText(doc);
    for (const marker of [
      "Marlene Ruck",
      "We pass on strong teams",
      "Tobias Lenz",
      "Founding Backend Engineer",
      "Halden",
    ])
      assert.ok(text.includes(marker), marker);
    assert.ok(JSON.stringify(doc).includes("https://www.start-berlin.com"));
    assert.ok(!JSON.stringify(doc).includes('"type":"newsletterBlock"'));
  });

  it("recognises Markdown without treating ordinary URLs as commands", () => {
    assert.equal(looksLikeMarkdown("## Gründer\n\n**Hallo** Berlin"), true);
    assert.equal(looksLikeMarkdown("One line\n- A list item"), true);
    assert.equal(
      looksLikeMarkdown("Visit https://example.com/path today."),
      false,
    );
    assert.equal(looksLikeMarkdown("Berlin / Brandenburg"), false);
  });
});
