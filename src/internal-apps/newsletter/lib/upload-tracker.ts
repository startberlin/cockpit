/** Uploads belong to running requests, never to the undoable document. */
export function createUploadTracker(onChange: (count: number) => void) {
  const pending = new Map<string, number>();
  let count = 0;
  return {
    isUploading(id: unknown): boolean {
      return typeof id === "string" && pending.has(id);
    },
    begin(id = crypto.randomUUID()): () => void {
      pending.set(id, (pending.get(id) ?? 0) + 1);
      onChange(++count);
      let finished = false;
      return () => {
        if (finished) return;
        finished = true;
        const requests = (pending.get(id) ?? 1) - 1;
        if (requests) pending.set(id, requests);
        else pending.delete(id);
        onChange(--count);
      };
    },
  };
}

export type UploadTracker = ReturnType<typeof createUploadTracker>;
