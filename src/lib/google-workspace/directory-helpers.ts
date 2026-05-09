import type { admin_directory_v1 } from "googleapis";

export type PageFetcher = (pageToken?: string) => Promise<{
  users: admin_directory_v1.Schema$User[] | undefined;
  nextPageToken?: string | null;
}>;

export async function collectAllPages<T>(
  fetchPage: PageFetcher,
  toCandidate: (user: admin_directory_v1.Schema$User) => T | null,
): Promise<T[]> {
  const items: T[] = [];
  let pageToken: string | undefined;

  do {
    const page = await fetchPage(pageToken);

    for (const user of page.users ?? []) {
      const candidate = toCandidate(user);
      if (candidate) items.push(candidate);
    }

    pageToken = page.nextPageToken ?? undefined;
  } while (pageToken);

  return items;
}
