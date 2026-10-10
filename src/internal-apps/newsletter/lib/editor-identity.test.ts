import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getSchema } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { closeHistory, history, undo } from "@tiptap/pm/history";
import { EditorState } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import { createDocumentIdentityPlugin } from "./editor-identity";

const schema = getSchema([
  StarterKit,
  Image.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        sourceId: { default: null },
        uploading: { default: false },
      };
    },
  }),
]);

describe("editor upload undo state", () => {
  it("clears an orphan upload restored by undo after the request completes", () => {
    let active = true;
    let state = EditorState.create({
      schema,
      doc: schema.nodeFromJSON({
        type: "doc",
        content: [
          { type: "image", attrs: { sourceId: "image", uploading: true } },
          { type: "paragraph" },
        ],
      }),
      plugins: [
        history(),
        createDocumentIdentityPlugin((id) => active && id === "image"),
      ],
    });
    state = state.applyTransaction(
      closeHistory(state.tr).setNodeMarkup(0, undefined, {
        ...state.doc.firstChild?.attrs,
        src: "https://example.com/upload.jpg",
        uploading: false,
      }),
    ).state;
    active = false;
    assert.equal(
      undo(state, (transaction) => {
        state = state.applyTransaction(transaction).state;
      }),
      true,
    );
    assert.equal(state.doc.firstChild?.attrs.src, null);
    assert.equal(state.doc.firstChild?.attrs.uploading, false);
  });

  it("retains the spinner when an image still has an active request", () => {
    const state = EditorState.create({
      schema,
      plugins: [createDocumentIdentityPlugin((id) => id === "active")],
    });
    const next = state.applyTransaction(
      state.tr.insert(
        0,
        schema.nodes.image.create({
          sourceId: "active",
          uploading: true,
        }),
      ),
    ).state;
    assert.equal(next.doc.firstChild?.attrs.uploading, true);
  });
});
