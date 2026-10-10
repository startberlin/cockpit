/** Keep writes in edit order, even when an earlier request is slow or fails. */
export function createSaveQueue<T>(write: (value: T) => Promise<void>) {
  let tail = Promise.resolve();
  return (value: T): Promise<void> => {
    const next = tail.then(() => write(value));
    tail = next.catch(() => {});
    return next;
  };
}

/** Each write uses the last acknowledged revision, including queued edits. */
export function createRevisionedSaveQueue<T>(
  initialRevision: string,
  write: (value: T, expectedRevision: string) => Promise<string>,
) {
  let revision = initialRevision;
  return createSaveQueue<T>(async (value) => {
    revision = await write(value, revision);
  });
}
