import { Plugin } from "@tiptap/pm/state";

export function createDocumentIdentityPlugin(
  isUploading: (id: unknown) => boolean,
) {
  return new Plugin({
    appendTransaction(transactions, _old, state) {
      if (!transactions.some((transaction) => transaction.docChanged))
        return null;
      const tr = state.tr;
      state.doc.forEach((node, pos) => {
        const attrs = { ...node.attrs };
        if (node.type.name !== "newsletterBlock" && !attrs.sourceId)
          attrs.sourceId = crypto.randomUUID();
        // Undo can restore an old placeholder after its request has finished.
        // Do not let that stale flag disable sending forever.
        if (attrs.uploading && !isUploading(attrs.sourceId))
          attrs.uploading = false;
        if (
          attrs.sourceId !== node.attrs.sourceId ||
          attrs.uploading !== node.attrs.uploading
        )
          tr.setNodeMarkup(pos, undefined, attrs);
      });
      return tr.docChanged ? tr.setMeta("addToHistory", false) : null;
    },
  });
}
