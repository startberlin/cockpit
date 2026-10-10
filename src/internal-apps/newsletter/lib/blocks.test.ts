import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BLOCK_CATALOG,
  type BlockKind,
  blocksSchema,
  createBlock,
  EMPTY_RICH_TEXT,
} from "./blocks";

const ALL_KINDS: BlockKind[] = BLOCK_CATALOG.map((entry) => entry.kind);

describe("newsletter blocks", () => {
  it("offers every block kind in the add menu", () => {
    // The catalog drives the UI, so a variant missing from it is a block the
    // renderer supports but nobody can insert.
    const parsed = blocksSchema.parse(
      ALL_KINDS.map((kind, i) => createBlock(kind, `b-${i}`)),
    );
    assert.equal(parsed.length, ALL_KINDS.length);
    assert.deepEqual(
      parsed.map((b) => b.kind),
      ALL_KINDS,
    );
  });

  it("creates every kind in a state the schema accepts", () => {
    for (const kind of ALL_KINDS) {
      const block = createBlock(kind, "b-1");
      assert.equal(block.kind, kind);
      assert.doesNotThrow(() => blocksSchema.parse([block]));
    }
  });

  it("survives a JSON round trip", () => {
    // Blocks are stored as jsonb and re-parsed on read, so anything the schema
    // cannot reproduce from its own output would corrupt a saved issue.
    const blocks = ALL_KINDS.map((kind, i) => createBlock(kind, `b-${i}`));
    const roundTripped = blocksSchema.parse(JSON.parse(JSON.stringify(blocks)));
    assert.deepEqual(roundTripped, blocks);
  });

  it("seeds a startup spotlight with the three-per-issue format", () => {
    const block = createBlock("startupSpotlight", "b-1");
    assert.equal(block.kind, "startupSpotlight");
    if (block.kind !== "startupSpotlight") return;
    assert.equal(block.items.length, 3);
  });

  it("gives text-bearing blocks an empty document rather than undefined", () => {
    for (const kind of [
      "text",
      "eventRecap",
      "interview",
      "alumniStory",
    ] as const) {
      const block = createBlock(kind, "b-1");
      assert.deepEqual(
        (block as { body: unknown }).body,
        EMPTY_RICH_TEXT,
        `${kind} should start with an empty document`,
      );
    }
  });

  it("rejects an unknown block kind", () => {
    assert.throws(() => blocksSchema.parse([{ id: "b-1", kind: "carousel" }]));
  });

  it("rejects a block without an id", () => {
    // Ids key the React list and the drag-and-drop sort; a block without one
    // reorders unpredictably.
    assert.throws(() => blocksSchema.parse([{ kind: "divider" }]));
  });

  it("accepts rich text with links and marks", () => {
    const parsed = blocksSchema.parse([
      {
        id: "b-1",
        kind: "text",
        body: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Read " },
                {
                  type: "text",
                  text: "the story",
                  marks: [
                    { type: "link", attrs: { href: "https://example.com" } },
                    { type: "bold" },
                  ],
                },
              ],
            },
          ],
        },
      },
    ]);
    assert.equal(parsed.length, 1);
  });
});
