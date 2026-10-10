import { z } from "zod";

/**
 * The block model is the single source of truth for the newsletter: the editor
 * builds these, the database stores them as jsonb, and the React Email renderer
 * consumes them. Adding a format means adding one variant here and one renderer
 * case — nothing else has to agree.
 *
 * The set of blocks mirrors the editorial formats the team settled on in the
 * newsletter format:
 * Berlin startup news, event recaps, VC/founder interviews, alumni stories,
 * three startups per issue, and job highlights.
 *
 * Client-safe: imported by both editor components and the schema, so it must
 * stay free of `server-only` and database imports.
 */

// --- shared value objects ---------------------------------------------------

export const imageRefSchema = z.object({
  url: z.string().min(1),
  /** Empty alt is meaningful (decorative), so it is allowed but never absent. */
  alt: z.string().default(""),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
export type ImageRef = z.infer<typeof imageRefSchema>;

// --- rich text --------------------------------------------------------------

export interface RichTextMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface RichTextNode {
  type: string;
  text?: string;
  marks?: RichTextMark[];
  attrs?: Record<string, unknown>;
  content?: RichTextNode[];
}

export interface RichTextDoc {
  type: "doc";
  content: RichTextNode[];
}

/**
 * ProseMirror attributes can have null prototypes. React Server Actions need
 * plain JSON objects, so normalize at the editor boundary before saving or
 * rendering a preview. JSON preserves the document's persisted data model.
 */
export function serializableRichText(doc: RichTextDoc): RichTextDoc {
  return JSON.parse(JSON.stringify(doc)) as RichTextDoc;
}

const richTextMarkSchema: z.ZodType<RichTextMark> = z.object({
  type: z.string(),
  attrs: z.record(z.string(), z.unknown()).optional(),
});

/**
 * ProseMirror/Tiptap document shape. Deliberately structural rather than an
 * exhaustive node enum: the editor is configured with a small extension set, and
 * the renderer whitelists the node and mark types it understands, so an unknown
 * node degrades to its text content instead of failing the whole issue to load.
 */
const richTextNodeSchema: z.ZodType<RichTextNode> = z.lazy(() =>
  z.object({
    type: z.string(),
    text: z.string().optional(),
    marks: z.array(richTextMarkSchema).optional(),
    attrs: z.record(z.string(), z.unknown()).optional(),
    content: z.array(richTextNodeSchema).optional(),
  }),
);

export const richTextDocSchema: z.ZodType<RichTextDoc> = z.object({
  type: z.literal("doc"),
  content: z.array(richTextNodeSchema),
});

export const EMPTY_RICH_TEXT: RichTextDoc = { type: "doc", content: [] };

// --- blocks -----------------------------------------------------------------

const withId = { id: z.string().min(1) };

export const heroBlockSchema = z.object({
  ...withId,
  kind: z.literal("hero"),
  image: imageRefSchema.optional(),
  eyebrow: z.string().default(""),
  headline: z.string().default(""),
  subheadline: z.string().default(""),
});

export const headingBlockSchema = z.object({
  ...withId,
  kind: z.literal("heading"),
  level: z.union([z.literal(2), z.literal(3)]).default(2),
  text: z.string().default(""),
});

export const textBlockSchema = z.object({
  ...withId,
  kind: z.literal("text"),
  body: richTextDocSchema,
});

export const imageBlockSchema = z.object({
  ...withId,
  kind: z.literal("image"),
  image: imageRefSchema.optional(),
  caption: z.string().default(""),
  href: z.string().default(""),
});

export const buttonBlockSchema = z.object({
  ...withId,
  kind: z.literal("button"),
  label: z.string().default(""),
  href: z.string().default(""),
  align: z.enum(["left", "center"]).default("left"),
});

export const dividerBlockSchema = z.object({
  ...withId,
  kind: z.literal("divider"),
});

/** Berlin startup news: a scannable list of outside links. */
export const linkListBlockSchema = z.object({
  ...withId,
  kind: z.literal("linkList"),
  title: z.string().default(""),
  items: z
    .array(
      z.object({
        title: z.string().default(""),
        url: z.string().default(""),
        source: z.string().default(""),
        blurb: z.string().default(""),
      }),
    )
    .default([]),
});

/** The "three startups per issue" section. */
export const startupSpotlightBlockSchema = z.object({
  ...withId,
  kind: z.literal("startupSpotlight"),
  title: z.string().default(""),
  items: z
    .array(
      z.object({
        name: z.string().default(""),
        oneLiner: z.string().default(""),
        url: z.string().default(""),
        tag: z.string().default(""),
        logo: imageRefSchema.optional(),
      }),
    )
    .default([]),
});

export const eventRecapBlockSchema = z.object({
  ...withId,
  kind: z.literal("eventRecap"),
  title: z.string().default(""),
  dateLabel: z.string().default(""),
  image: imageRefSchema.optional(),
  body: richTextDocSchema,
  ctaLabel: z.string().default(""),
  ctaHref: z.string().default(""),
});

export const interviewBlockSchema = z.object({
  ...withId,
  kind: z.literal("interview"),
  name: z.string().default(""),
  role: z.string().default(""),
  company: z.string().default(""),
  portrait: imageRefSchema.optional(),
  quote: z.string().default(""),
  body: richTextDocSchema,
  href: z.string().default(""),
});

export const alumniStoryBlockSchema = z.object({
  ...withId,
  kind: z.literal("alumniStory"),
  name: z.string().default(""),
  batchLabel: z.string().default(""),
  portrait: imageRefSchema.optional(),
  headline: z.string().default(""),
  body: richTextDocSchema,
  href: z.string().default(""),
});

export const jobHighlightBlockSchema = z.object({
  ...withId,
  kind: z.literal("jobHighlight"),
  title: z.string().default(""),
  items: z
    .array(
      z.object({
        company: z.string().default(""),
        role: z.string().default(""),
        location: z.string().default(""),
        url: z.string().default(""),
        logo: imageRefSchema.optional(),
      }),
    )
    .default([]),
});

export const blockSchema = z.discriminatedUnion("kind", [
  heroBlockSchema,
  headingBlockSchema,
  textBlockSchema,
  imageBlockSchema,
  buttonBlockSchema,
  dividerBlockSchema,
  linkListBlockSchema,
  startupSpotlightBlockSchema,
  eventRecapBlockSchema,
  interviewBlockSchema,
  alumniStoryBlockSchema,
  jobHighlightBlockSchema,
]);

export const blocksSchema = z.array(blockSchema);

export type Block = z.infer<typeof blockSchema>;
export type BlockKind = Block["kind"];
export type BlockOfKind<K extends BlockKind> = Extract<Block, { kind: K }>;

// --- catalog ----------------------------------------------------------------

/**
 * Drives the "add block" menu. Kept next to the schemas so a new block variant
 * that is not offered in the UI is immediately visible as a missing entry.
 */
export const BLOCK_CATALOG: {
  kind: BlockKind;
  label: string;
  description: string;
}[] = [
  {
    kind: "hero",
    label: "Hero",
    description: "Opening image with a headline. One per issue.",
  },
  {
    kind: "heading",
    label: "Section heading",
    description: "Breaks the issue into scannable sections.",
  },
  {
    kind: "text",
    label: "Text",
    description: "Formatted paragraph with bold, italic and links.",
  },
  {
    kind: "linkList",
    label: "Berlin startup news",
    description: "A list of outside links with a short line each.",
  },
  {
    kind: "startupSpotlight",
    label: "Startup spotlight",
    description: "Three startups with a one-liner each.",
  },
  {
    kind: "eventRecap",
    label: "Event recap",
    description: "What happened, with a photo and a link.",
  },
  {
    kind: "interview",
    label: "Interview",
    description: "A founder or VC, with a pull quote.",
  },
  {
    kind: "alumniStory",
    label: "Alumni story",
    description: "Where a former member landed.",
  },
  {
    kind: "jobHighlight",
    label: "Job highlights",
    description: "Open roles from the partner network.",
  },
  { kind: "image", label: "Image", description: "A standalone image." },
  { kind: "button", label: "Button", description: "A single call to action." },
  { kind: "divider", label: "Divider", description: "A horizontal rule." },
];

const BLOCK_LABELS = new Map(BLOCK_CATALOG.map((e) => [e.kind, e.label]));

export function blockLabel(kind: BlockKind): string {
  return BLOCK_LABELS.get(kind) ?? kind;
}

/**
 * Builds an empty block of the given kind. Parsing an almost-empty object
 * through the schema means the defaults declared above are the only place a
 * block's initial state is written down.
 */
export function createBlock(kind: BlockKind, id: string): Block {
  const base = { id, kind } as Record<string, unknown>;

  switch (kind) {
    case "text":
      base.body = EMPTY_RICH_TEXT;
      break;
    case "eventRecap":
    case "interview":
    case "alumniStory":
      base.body = EMPTY_RICH_TEXT;
      break;
    case "linkList":
      base.items = [{ title: "", url: "", source: "", blurb: "" }];
      break;
    case "startupSpotlight":
      base.items = [
        { name: "", oneLiner: "", url: "", tag: "" },
        { name: "", oneLiner: "", url: "", tag: "" },
        { name: "", oneLiner: "", url: "", tag: "" },
      ];
      break;
    case "jobHighlight":
      base.items = [{ company: "", role: "", location: "", url: "" }];
      break;
    default:
      break;
  }

  return blockSchema.parse(base);
}
