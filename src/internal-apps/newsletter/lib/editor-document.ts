import {
  type Block,
  blockSchema,
  type ImageRef,
  type RichTextDoc,
  type RichTextNode,
  serializableRichText,
} from "./blocks";

const paragraph = (text = ""): RichTextNode => ({
  type: "paragraph",
  ...(text ? { content: [{ type: "text", text }] } : {}),
});
const heading = (text: string, level = 2): RichTextNode => ({
  ...paragraph(text),
  type: "heading",
  attrs: { level },
});
const link = (text: string, href: string): RichTextNode => ({
  type: "paragraph",
  content: text
    ? [
        {
          type: "text",
          text,
          ...(href ? { marks: [{ type: "link", attrs: { href } }] } : {}),
        },
      ]
    : [],
});

export function imageNode(
  image?: ImageRef,
  attrs: Record<string, unknown> = {},
): RichTextNode {
  return {
    type: "image",
    attrs: {
      src: image?.url ?? null,
      alt: image?.alt ?? "",
      width: image?.width ?? null,
      height: image?.height ?? null,
      ...attrs,
    },
  };
}

/** Old structured editions and the new continuous document share the existing
 * storage contract. Opening an edition never migrates or writes its content. */
export function blocksToDocument(blocks: Block[]): RichTextDoc {
  const content = blocks.flatMap((block): RichTextNode[] => {
    switch (block.kind) {
      case "text":
        return (
          block.body.content.length ? block.body.content : [paragraph()]
        ).map((node) => ({
          ...node,
          attrs: { ...node.attrs, sourceId: block.id },
        }));
      case "heading":
        return [
          {
            ...heading(block.text, block.level),
            attrs: {
              level: block.level,
              sourceId: block.id,
              sourceKind: "heading",
            },
          },
        ];
      case "divider":
        return [{ type: "horizontalRule", attrs: { sourceId: block.id } }];
      case "image":
        return [
          imageNode(block.image, {
            sourceId: block.id,
            caption: block.caption,
            href: block.href,
          }),
        ];
      default:
        return [{ type: "newsletterBlock", attrs: { block } }];
    }
  });
  if (
    !content.length ||
    !["paragraph", "heading"].includes(content.at(-1)?.type ?? "")
  )
    content.push(paragraph());
  return serializableRichText({ type: "doc", content });
}

export function safeUrl(value: unknown, image = false): string {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value);
    return (image
      ? ["http:", "https:"]
      : ["http:", "https:", "mailto:", "tel:"]
    ).includes(url.protocol)
      ? value
      : "";
  } catch {
    return "";
  }
}

function stripSource(node: RichTextNode): RichTextNode {
  const { sourceId: _id, sourceKind: _kind, ...attrs } = node.attrs ?? {};
  const { attrs: _attrs, ...base } = node;
  return {
    ...base,
    ...(Object.keys(attrs).length ? { attrs } : {}),
    ...(node.content ? { content: node.content.map(stripSource) } : {}),
  };
}

/** IDs are retained across edits. Split, pasted and duplicated blocks get unique
 * IDs even when ProseMirror inherits the source attributes of a paragraph. */
export function documentToBlocks(
  doc: RichTextDoc,
  makeId: () => string = () => crypto.randomUUID(),
): Block[] {
  const result: Block[] = [];
  const used = new Set<string>();
  const idFor = (candidate: unknown) => {
    const id =
      typeof candidate === "string" && candidate && !used.has(candidate)
        ? candidate
        : makeId();
    used.add(id);
    return id;
  };
  let textGroup: Extract<Block, { kind: "text" }> | undefined;
  let source: unknown;
  for (const node of doc.content) {
    const attrs = node.attrs ?? {};
    if (node.type === "newsletterBlock") {
      const parsed = blockSchema.safeParse(attrs.block);
      if (parsed.success)
        result.push({ ...parsed.data, id: idFor(parsed.data.id) });
      textGroup = undefined;
    } else if (node.type === "image") {
      const src = safeUrl(attrs.src, true);
      result.push({
        id: idFor(attrs.sourceId),
        kind: "image",
        ...(src
          ? {
              image: {
                url: src,
                alt: String(attrs.alt ?? ""),
                ...(Number(attrs.width) > 0
                  ? { width: Math.round(Number(attrs.width)) }
                  : {}),
                ...(Number(attrs.height) > 0
                  ? { height: Math.round(Number(attrs.height)) }
                  : {}),
              },
            }
          : {}),
        caption: String(attrs.caption ?? ""),
        href: safeUrl(attrs.href),
      });
      textGroup = undefined;
    } else if (node.type === "horizontalRule") {
      result.push({ id: idFor(attrs.sourceId), kind: "divider" });
      textGroup = undefined;
    } else if (
      node.type === "heading" &&
      attrs.sourceKind === "heading" &&
      (attrs.level === 2 || attrs.level === 3) &&
      !attrs.textAlign &&
      !(node.content ?? []).some((child) => child.marks?.length)
    ) {
      result.push({
        id: idFor(attrs.sourceId),
        kind: "heading",
        level: attrs.level === 3 ? 3 : 2,
        text: (node.content ?? []).map((child) => child.text ?? "").join(""),
      });
      textGroup = undefined;
    } else {
      if (!textGroup || source !== attrs.sourceId) {
        textGroup = {
          id: idFor(attrs.sourceId),
          kind: "text",
          body: { type: "doc", content: [] },
        };
        source = attrs.sourceId;
        result.push(textGroup);
      }
      textGroup.body.content.push(stripSource(node));
    }
  }
  // The empty paragraph after an atomic block is a cursor landing spot, not
  // newsletter content. Preserve intentional blank lines inside a text block.
  const last = result.at(-1);
  if (
    last?.kind === "text" &&
    last.body.content.every(
      (node) => node.type === "paragraph" && !node.content?.length,
    )
  )
    result.pop();
  return JSON.parse(JSON.stringify(result)) as Block[];
}

/** Explicitly converting a template to text is undoable in the editor. Every
 * editorial field and link is retained, including image descriptions. */
export function expandBlock(block: Block): RichTextNode[] {
  const picture = (image?: ImageRef) => (image ? [imageNode(image)] : []);
  switch (block.kind) {
    case "text":
      return block.body.content;
    case "heading":
      return [heading(block.text, block.level)];
    case "divider":
      return [{ type: "horizontalRule" }];
    case "image":
      return [
        imageNode(block.image, { caption: block.caption, href: block.href }),
      ];
    case "button":
      return [link(block.label, block.href)];
    case "hero":
      return [
        ...picture(block.image),
        ...(block.eyebrow ? [paragraph(block.eyebrow)] : []),
        heading(block.headline, 1),
        paragraph(block.subheadline),
      ];
    case "linkList":
      return [
        heading(block.title),
        ...block.items.flatMap((item) => [
          link(item.title, item.url),
          paragraph([item.source, item.blurb].filter(Boolean).join(" · ")),
        ]),
      ];
    case "startupSpotlight":
      return [
        heading(block.title),
        ...block.items.flatMap((item) => [
          ...picture(item.logo),
          link(item.name, item.url),
          paragraph([item.tag, item.oneLiner].filter(Boolean).join(" · ")),
        ]),
      ];
    case "eventRecap":
      return [
        ...picture(block.image),
        paragraph(block.dateLabel),
        heading(block.title),
        ...block.body.content,
        ...(block.ctaLabel || block.ctaHref
          ? [link(block.ctaLabel || "Read more", block.ctaHref)]
          : []),
      ];
    case "interview":
      return [
        ...picture(block.portrait),
        heading(block.name),
        paragraph([block.role, block.company].filter(Boolean).join(" · ")),
        { type: "blockquote", content: [paragraph(block.quote)] },
        ...block.body.content,
        ...(block.href ? [link("Read the interview", block.href)] : []),
      ];
    case "alumniStory":
      return [
        ...picture(block.portrait),
        paragraph([block.name, block.batchLabel].filter(Boolean).join(" · ")),
        heading(block.headline),
        ...block.body.content,
        ...(block.href ? [link("Read the story", block.href)] : []),
      ];
    case "jobHighlight":
      return [
        heading(block.title),
        ...block.items.flatMap((item) => [
          ...picture(item.logo),
          link(item.role, item.url),
          paragraph([item.company, item.location].filter(Boolean).join(" · ")),
        ]),
      ];
  }
}

export function documentText(doc: RichTextDoc): string {
  const visit = (node: RichTextNode): string => {
    if (node.type === "hardBreak") return " ";
    if (node.type === "image") return String(node.attrs?.caption ?? "");
    if (node.type === "newsletterBlock") {
      const parsed = blockSchema.safeParse(node.attrs?.block);
      return parsed.success
        ? expandBlock(parsed.data).map(visit).join(" ")
        : "";
    }
    return (
      node.text ??
      (node.content ?? [])
        .map(visit)
        .join(node.type === "paragraph" || node.type === "heading" ? "" : " ")
    );
  };
  return doc.content.map(visit).join(" ").trim();
}

/** Copyable text retains the structure and links that a word count flattens. */
export function documentPlainText(doc: RichTextDoc): string {
  const visit = (node: RichTextNode): string => {
    if (node.type === "text") {
      const text = node.text ?? "";
      const href = safeUrl(
        node.marks?.find((mark) => mark.type === "link")?.attrs?.href,
      );
      return href && href !== text ? `${text} (${href})` : text;
    }
    if (node.type === "hardBreak") return "\n";
    if (node.type === "horizontalRule") return "---";
    if (node.type === "image")
      return [
        node.attrs?.alt,
        safeUrl(node.attrs?.src, true),
        node.attrs?.caption,
      ]
        .filter(Boolean)
        .join("\n");
    if (node.type === "newsletterBlock") {
      const parsed = blockSchema.safeParse(node.attrs?.block);
      return parsed.success
        ? expandBlock(parsed.data).map(visit).join("\n\n")
        : "";
    }
    const content = node.content ?? [];
    if (node.type === "bulletList" || node.type === "orderedList") {
      const start = Number(node.attrs?.start) || 1;
      return content
        .map((item, index) => {
          const marker =
            node.type === "orderedList" ? `${start + index}. ` : "- ";
          return `${marker}${visit(item).replace(/\n/g, `\n${" ".repeat(marker.length)}`)}`;
        })
        .join("\n");
    }
    if (node.type === "blockquote")
      return content
        .map(visit)
        .join("\n\n")
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    const separator = ["paragraph", "heading", "codeBlock"].includes(node.type)
      ? ""
      : node.type === "listItem"
        ? "\n"
        : "\n\n";
    return content.map(visit).join(separator);
  };
  return doc.content.map(visit).join("\n\n").trim();
}

export function looksLikeMarkdown(text: string): boolean {
  return /(^|\n)(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```|---\s*$)|\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\//m.test(
    text,
  );
}
