import type { Block, RichTextDoc, RichTextNode } from "./blocks";

/**
 * A one-line description of what a block currently contains.
 *
 * Used on collapsed blocks so a twelve-section issue stays scannable: a column
 * of identical "Text" headers tells you nothing, while the first few words of
 * each one tells you where you are.
 */

function plainText(node: RichTextNode): string {
  if (node.text) return node.text;
  return (node.content ?? []).map(plainText).join("");
}

function docText(doc: RichTextDoc | undefined): string {
  if (!doc?.content?.length) return "";
  return doc.content.map(plainText).join(" ").trim();
}

function truncate(value: string, max = 70): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

function countFilled(items: { [key: string]: unknown }[], keys: string[]) {
  return items.filter((item) =>
    keys.some((key) =>
      typeof item[key] === "string" ? item[key].trim().length > 0 : !!item[key],
    ),
  ).length;
}

export function blockSummary(block: Block): string {
  switch (block.kind) {
    case "hero":
      return truncate(block.headline || block.eyebrow) || "No headline yet";
    case "heading":
      return truncate(block.text) || "No heading yet";
    case "text":
      return truncate(docText(block.body)) || "Empty";
    case "image":
      return block.image
        ? truncate(block.image.alt || block.caption) || "No alt text"
        : "No image yet";
    case "button":
      return truncate(block.label) || "No label yet";
    case "divider":
      return "";
    case "linkList": {
      const n = countFilled(block.items, ["title", "url"]);
      return `${block.title ? `${truncate(block.title, 34)} · ` : ""}${n} link${n === 1 ? "" : "s"}`;
    }
    case "startupSpotlight": {
      const names = block.items.map((i) => i.name).filter(Boolean);
      return names.length ? truncate(names.join(", ")) : "No startups yet";
    }
    case "eventRecap":
      return truncate(block.title || docText(block.body)) || "No title yet";
    case "interview":
      return (
        truncate([block.name, block.company].filter(Boolean).join(" · ")) ||
        "No interviewee yet"
      );
    case "alumniStory":
      return truncate(block.name || block.headline) || "No name yet";
    case "jobHighlight": {
      const n = countFilled(block.items, ["role", "company"]);
      return `${n} role${n === 1 ? "" : "s"}`;
    }
  }
}

/**
 * Whether a block would render as nothing.
 *
 * Surfaced in the editor because an empty block is invisible in the preview,
 * which makes it very easy to leave one behind and wonder why the issue looks
 * short.
 */
export function isBlockEmpty(block: Block): boolean {
  switch (block.kind) {
    case "divider":
      return false;
    case "hero":
      return (
        !block.headline.trim() &&
        !block.eyebrow.trim() &&
        !block.subheadline.trim() &&
        !block.image
      );
    case "heading":
      return !block.text.trim();
    case "text":
      return !docText(block.body);
    case "image":
      return !block.image;
    case "button":
      return !block.label.trim() || !block.href.trim();
    case "linkList":
      return countFilled(block.items, ["title", "url"]) === 0;
    case "startupSpotlight":
      return countFilled(block.items, ["name", "oneLiner"]) === 0;
    case "eventRecap":
      return !block.title.trim() && !block.image && !docText(block.body);
    case "interview":
      return !block.name.trim() && !block.quote.trim() && !docText(block.body);
    case "alumniStory":
      return (
        !block.name.trim() && !block.headline.trim() && !docText(block.body)
      );
    case "jobHighlight":
      return countFilled(block.items, ["role", "company"]) === 0;
  }
}
