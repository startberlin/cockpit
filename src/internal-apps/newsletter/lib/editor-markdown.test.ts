import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getSchema } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { Markdown, MarkdownManager } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { NewsletterLink, parseEditorMarkdown } from "./editor-markdown";

const extensions = [
  StarterKit.configure({ link: false }),
  NewsletterLink,
  Image,
  Markdown,
];
const parser = new MarkdownManager({ extensions });
const schema = getSchema(extensions);

describe("Markdown image imports", () => {
  it("imports image-only list items with a valid leading paragraph", () => {
    for (const marker of ["-", "1."]) {
      const doc = parseEditorMarkdown(
        parser,
        `${marker} ![Photo](https://example.com/p.jpg)`,
      );
      assert.doesNotThrow(() => schema.nodeFromJSON(doc).check());
      const item = doc.content[0].content?.[0];
      assert.equal(item?.content?.[0].type, "paragraph");
      assert.equal(item?.content?.[1].type, "image");
      assert.equal(item?.content?.[1].attrs?.alt, "Photo");
    }
  });

  it("imports an exported linked image as a valid block with its click target", () => {
    const doc = parseEditorMarkdown(
      parser,
      "# Story\n\n[![Team](https://example.com/team.jpg)](https://example.com/about)\n\nPhoto: our team.",
    );
    assert.doesNotThrow(() => schema.nodeFromJSON(doc).check());
    const image = doc.content.find((node) => node.type === "image");
    assert.equal(image?.attrs?.src, "https://example.com/team.jpg");
    assert.equal(image?.attrs?.href, "https://example.com/about");
    assert.equal(image?.attrs?.alt, "Team");
    assert.ok(JSON.stringify(doc).includes("Photo: our team."));
  });

  it("retains text on both sides of an inline image", () => {
    const doc = parseEditorMarkdown(
      parser,
      "Before ![Photo](https://example.com/p.jpg) after.",
    );
    assert.doesNotThrow(() => schema.nodeFromJSON(doc).check());
    assert.deepEqual(
      doc.content.map((node) => node.type),
      ["paragraph", "image", "paragraph"],
    );
    assert.equal(doc.content[0].content?.[0].text, "Before ");
    assert.equal(doc.content[2].content?.[0].text, " after.");
  });

  it("keeps images inside list items valid and preserves nested text marks", () => {
    const doc = parseEditorMarkdown(
      parser,
      "- A **bold** point ![Photo](https://example.com/p.jpg)\n- [A link](https://example.com)",
    );
    assert.doesNotThrow(() => schema.nodeFromJSON(doc).check());
    assert.equal(doc.content[0].type, "bulletList");
    assert.ok(JSON.stringify(doc).includes('"type":"bold"'));
    assert.ok(JSON.stringify(doc).includes('"type":"link"'));
  });
});
