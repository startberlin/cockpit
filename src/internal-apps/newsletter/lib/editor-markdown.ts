import type { JSONContent } from "@tiptap/core";
import Link from "@tiptap/extension-link";
import type { MarkdownManager } from "@tiptap/markdown";
import type { RichTextDoc, RichTextNode } from "./blocks";

/** Tiptap's default link parser applies marks to text only. An image needs the
 * link on its own attributes so it survives as a standalone email block. */
export const NewsletterLink = Link.extend({
  parseMarkdown(token, helpers) {
    const attrs = { href: token.href, title: token.title || null };
    const apply = (node: JSONContent): JSONContent => {
      if (node.type === "image")
        return { ...node, attrs: { ...node.attrs, href: token.href } };
      if (node.type === "text")
        return {
          ...node,
          marks: [...(node.marks ?? []), { type: "link", attrs }],
        };
      return {
        ...node,
        ...(node.content ? { content: node.content.map(apply) } : {}),
      };
    };
    return helpers.parseInline(token.tokens ?? []).map(apply);
  },
}).configure({ openOnClick: false, autolink: true, defaultProtocol: "https" });

/** Markdown allows an image inside a paragraph; the document uses block
 * images. Split the paragraph around each image before ProseMirror validates
 * it, retaining text on both sides and list/quote nesting. */
export function normalizeMarkdownDocument(doc: RichTextDoc): RichTextDoc {
  const normalize = (node: RichTextNode): RichTextNode[] => {
    if (
      (node.type === "paragraph" || node.type === "heading") &&
      node.content?.some((child) => child.type === "image")
    ) {
      const result: RichTextNode[] = [];
      let inline: RichTextNode[] = [];
      const flush = () => {
        if (inline.length) result.push({ ...node, content: inline });
        inline = [];
      };
      for (const child of node.content) {
        if (child.type === "image") {
          flush();
          result.push(child);
        } else inline.push(child);
      }
      flush();
      return result;
    }
    const content = node.content?.flatMap(normalize);
    // ProseMirror requires each list item to begin with a paragraph, including
    // a Markdown item whose only content is an image.
    if (node.type === "listItem" && content?.[0]?.type !== "paragraph")
      content?.unshift({ type: "paragraph" });
    return [{ ...node, ...(content ? { content } : {}) }];
  };
  return { type: "doc", content: doc.content.flatMap(normalize) };
}

export function parseEditorMarkdown(
  parser: MarkdownManager | undefined,
  text: string,
): RichTextDoc {
  if (!parser) throw new Error("Markdown is not available yet.");
  return normalizeMarkdownDocument(parser.parse(text) as RichTextDoc);
}
