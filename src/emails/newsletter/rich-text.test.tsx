import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { RichTextDoc } from "@/internal-apps/newsletter/lib/blocks";
import { NewsletterBlock } from "./newsletter-blocks";
import { RichText } from "./rich-text";

describe("freeform email rendering", () => {
  it("keeps separate paragraphs inside a list item readable", () => {
    const html = renderToStaticMarkup(
      <RichText
        doc={{
          type: "doc",
          content: [
            {
              type: "bulletList",
              content: [
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "First paragraph" }],
                    },
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Second paragraph" }],
                    },
                  ],
                },
              ],
            },
          ],
        }}
      />,
    );
    assert.match(html, /First paragraph[\s\S]*<br\/>[\s\S]*Second paragraph/);
  });

  it("reserves the stored aspect ratio for images nested in rich text", () => {
    const html = renderToStaticMarkup(
      <RichText
        doc={{
          type: "doc",
          content: [
            {
              type: "image",
              attrs: {
                src: "https://example.com/image.png",
                width: 1200,
                height: 600,
              },
            },
          ],
        }}
      />,
    );
    assert.match(html, /width="520"/);
    assert.match(html, /height="260"/);
  });

  it("applies the same URL policy to structured template links and images", () => {
    const html = renderToStaticMarkup(
      <NewsletterBlock
        block={{
          id: "links",
          kind: "linkList",
          title: "News",
          items: [
            {
              title: "Retain this title",
              url: "data:text/html,<script>alert(1)</script>",
              source: "",
              blurb: "",
            },
          ],
        }}
      />,
    );
    assert.match(html, /Retain this title/);
    assert.doesNotMatch(html, /data:text/);
    const image = renderToStaticMarkup(
      <NewsletterBlock
        block={{
          id: "image",
          kind: "image",
          image: { url: "data:image/png;base64,bad", alt: "" },
          href: "",
          caption: "",
        }}
      />,
    );
    assert.doesNotMatch(image, /<img/);
  });

  it("preserves pasted typography, alignment and marks in the actual email", () => {
    const doc: RichTextDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { textAlign: "center" },
          content: [
            {
              type: "text",
              text: "Gründer",
              marks: [
                {
                  type: "textStyle",
                  attrs: {
                    color: "#2563EB",
                    fontSize: "20px",
                    fontFamily: "Georgia",
                  },
                },
                { type: "underline" },
                { type: "highlight", attrs: { color: "#FEF08A" } },
              ],
            },
          ],
        },
      ],
    };
    const html = renderToStaticMarkup(<RichText doc={doc} />);
    for (const style of [
      "text-align:center",
      "color:#2563EB",
      "font-size:20px",
      "font-family:Georgia",
      "background-color:#FEF08A",
      "<u>",
    ])
      assert.ok(html.includes(style), style);
  });

  it("renders native rules, code and ordered lists without losing content", () => {
    const doc: RichTextDoc = {
      type: "doc",
      content: [
        { type: "horizontalRule" },
        {
          type: "codeBlock",
          content: [{ type: "text", text: "const value = 42;" }],
        },
        {
          type: "orderedList",
          attrs: { start: 3 },
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Third point" }],
                },
              ],
            },
          ],
        },
      ],
    };
    const html = renderToStaticMarkup(<RichText doc={doc} />);
    assert.match(html, /<hr/);
    assert.match(html, /<pre/);
    assert.match(html, /const value = 42;/);
    assert.match(html, /start="3"/);
    assert.match(html, /Third point/);
  });

  it("drops unsupported styles and unsafe URLs while retaining their text", () => {
    const doc: RichTextDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Still readable",
              marks: [
                {
                  type: "textStyle",
                  attrs: {
                    color: "url(https://example.com/tracking)",
                    fontFamily: "bad;display:none",
                    fontSize: "999999px",
                  },
                },
                { type: "link", attrs: { href: "javascript:alert(1)" } },
              ],
            },
          ],
        },
      ],
    };
    const html = renderToStaticMarkup(<RichText doc={doc} />);
    assert.match(html, /Still readable/);
    assert.doesNotMatch(html, /javascript:|display:none|999999px|url\(/);
  });
});
