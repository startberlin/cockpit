import "server-only";

import { max, notInArray, sql } from "drizzle-orm";
import db from "@/db";
import { newId } from "@/lib/id";
import { newsletterContact } from "../db/schema";
import {
  listAllContacts,
  listContactTopicSubscriptions,
  listSegments,
  listTopics,
} from "./resend";

/** Bounds in-flight calls. The Resend client enforces the request rate. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  let stopped = false;

  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    (async () => {
      while (!stopped) {
        const index = cursor++;
        if (index >= items.length) return;
        try {
          results[index] = await task(items[index]);
        } catch (error) {
          stopped = true;
          throw error;
        }
      }
    })(),
  );

  await Promise.all(workers);
  return results;
}

const lastSyncSelection = { lastSyncedAt: max(newsletterContact.syncedAt) };

/** Pulls a complete Resend snapshot before replacing any local data. */
export async function syncAudience(): Promise<{ synced: number }> {
  const [{ lastSyncedAt: previousSync }] = await db
    .select(lastSyncSelection)
    .from(newsletterContact);
  const [contacts, segments, topics] = await Promise.all([
    listAllContacts(),
    listSegments(),
    listTopics(),
  ]);

  const memberships = new Map<string, string[]>();
  const segmentLists = await mapWithConcurrency(segments, 4, (segment) =>
    listAllContacts({ segmentId: segment.id }),
  );
  for (const [index, members] of segmentLists.entries()) {
    for (const contact of members) {
      const ids = memberships.get(contact.id) ?? [];
      ids.push(segments[index].id);
      memberships.set(contact.id, ids);
    }
  }

  const rows = await mapWithConcurrency(contacts, 8, async (contact) => ({
    id: newId("newsletterContact"),
    resendContactId: contact.id,
    email: contact.email,
    firstName: contact.firstName,
    lastName: contact.lastName,
    unsubscribed: contact.unsubscribed,
    resendCreatedAt: contact.createdAt ? new Date(contact.createdAt) : null,
    segments: memberships.get(contact.id) ?? [],
    topics: topics.length
      ? await listContactTopicSubscriptions(contact.id)
      : {},
  }));

  await db.transaction(async (tx) => {
    // Serialize all audience writers while checking and replacing the snapshot.
    // Ordinary reads can continue while this lock is held.
    await tx.execute(
      sql`lock table ${newsletterContact} in share row exclusive mode`,
    );
    const [{ lastSyncedAt: currentSync }] = await tx
      .select(lastSyncSelection)
      .from(newsletterContact);
    if (currentSync?.getTime() !== previousSync?.getTime()) {
      throw new Error("The audience changed during sync. Try syncing again.");
    }

    // Deleting obsolete IDs first allows the same email to be recreated in Resend.
    await tx.delete(newsletterContact).where(
      rows.length
        ? notInArray(
            newsletterContact.resendContactId,
            rows.map((row) => row.resendContactId),
          )
        : undefined,
    );

    const syncedAt = new Date();
    for (let offset = 0; offset < rows.length; offset += 500) {
      await tx
        .insert(newsletterContact)
        .values(
          rows.slice(offset, offset + 500).map((row) => ({ ...row, syncedAt })),
        )
        .onConflictDoUpdate({
          target: newsletterContact.resendContactId,
          set: {
            email: sql`excluded.email`,
            firstName: sql`excluded.first_name`,
            lastName: sql`excluded.last_name`,
            unsubscribed: sql`excluded.unsubscribed`,
            resendCreatedAt: sql`excluded.resend_created_at`,
            segments: sql`excluded.segments`,
            topics: sql`excluded.topics`,
            syncedAt,
          },
        });
    }
  });

  return { synced: rows.length };
}
