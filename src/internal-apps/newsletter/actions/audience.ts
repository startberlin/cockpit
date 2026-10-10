"use server";

import { and, eq, notInArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import db from "@/db";
import { actionClient } from "@/lib/action-client";
import { newId } from "@/lib/id";
import { newsletterContact } from "../db/schema";
import { assertNewsletterAccess } from "../lib/access";
import {
  addContactToSegment,
  listAllContacts,
  listSegments,
  sendMode,
} from "../lib/resend";
import { assignSegmentSchema } from "./schemas";

/**
 * Runs `task` over `items` with a bounded number in flight.
 *
 * The actual request rate is governed by the throttle inside `lib/resend.ts`;
 * this only bounds how many promises are alive at once so a few hundred
 * contacts do not all allocate at the same moment.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    (async () => {
      while (true) {
        const index = cursor++;
        if (index >= items.length) return;
        results[index] = await task(items[index], index);
      }
    })(),
  );

  await Promise.all(workers);
  return results;
}

/**
 * Pulls the contact book into the local mirror.
 *
 * Segment membership has its own explicit refresh action.
 */
export const syncContactsAction = actionClient.action(async () => {
  await assertNewsletterAccess();

  const remote = await listAllContacts();
  const syncedAt = new Date();

  // Only replace the mirror after a complete read. Removing obsolete IDs
  // first also handles a contact being recreated with the same email address.
  await db.transaction(async (tx) => {
    await tx.delete(newsletterContact).where(
      remote.length
        ? notInArray(
            newsletterContact.resendContactId,
            remote.map((contact) => contact.id),
          )
        : undefined,
    );
    // Bound SQL parameter counts while avoiding a database round trip per contact.
    for (let offset = 0; offset < remote.length; offset += 500) {
      await tx
        .insert(newsletterContact)
        .values(
          remote.slice(offset, offset + 500).map((contact) => ({
            id: newId("newsletterContact"),
            resendContactId: contact.id,
            email: contact.email,
            firstName: contact.firstName,
            lastName: contact.lastName,
            unsubscribed: contact.unsubscribed,
            syncedAt,
            resendCreatedAt: contact.createdAt
              ? new Date(contact.createdAt)
              : null,
          })),
        )
        .onConflictDoUpdate({
          target: newsletterContact.resendContactId,
          set: {
            email: sql`excluded.email`,
            firstName: sql`excluded.first_name`,
            lastName: sql`excluded.last_name`,
            unsubscribed: sql`excluded.unsubscribed`,
            resendCreatedAt: sql`excluded.resend_created_at`,
            syncedAt,
          },
        });
    }
  });

  revalidatePath("/newsletter/audience");
  return { synced: remote.length };
});

/**
 * Refreshes which segments each contact belongs to.
 *
 * Read contacts per segment in pages. Only replace the mirror once every
 * page succeeds, so a partial API response cannot erase known memberships.
 */
export const refreshSegmentMembershipAction = actionClient.action(async () => {
  await assertNewsletterAccess();

  const rows = await db
    .select({
      id: newsletterContact.id,
      resendContactId: newsletterContact.resendContactId,
    })
    .from(newsletterContact);

  const segments = await listSegments();
  const lists = await mapWithConcurrency(segments, 4, async (segment) => ({
    id: segment.id,
    contacts: await listAllContacts({ segmentId: segment.id }),
  }));
  const memberships = new Map<string, string[]>();
  for (const segment of lists) {
    for (const contact of segment.contacts) {
      const ids = memberships.get(contact.id) ?? [];
      ids.push(segment.id);
      memberships.set(contact.id, ids);
    }
  }
  await db.transaction(async (tx) => {
    for (const row of rows) {
      await tx
        .update(newsletterContact)
        .set({
          segments: memberships.get(row.resendContactId) ?? [],
          syncedAt: new Date(),
        })
        .where(eq(newsletterContact.id, row.id));
    }
  });

  revalidatePath("/newsletter/audience");
  return { checked: rows.length };
});

/**
 * Adds every subscribed contact to a segment.
 *
 * This exists because the account's segments were created but never populated:
 * all contacts sit in the global book and belong to no segment, so a broadcast
 * addressed to one is accepted and delivered to nobody. Already-assigned
 * contacts are skipped, so it is safe to re-run.
 */
export const assignSegmentAction = actionClient
  .inputSchema(assignSegmentSchema)
  .action(async ({ parsedInput }) => {
    await assertNewsletterAccess();

    const rows = await db
      .select({
        id: newsletterContact.id,
        resendContactId: newsletterContact.resendContactId,
        segments: newsletterContact.segments,
      })
      .from(newsletterContact)
      .where(eq(newsletterContact.unsubscribed, false));

    const pending = rows.filter(
      (row) => !(row.segments ?? []).includes(parsedInput.segmentId),
    );

    if (sendMode() === "sandbox") {
      return {
        added: 0,
        simulated: pending.length,
        skipped: rows.length - pending.length,
        failed: 0,
        firstError: null,
        mode: "sandbox" as const,
      };
    }

    let added = 0;
    const failures: string[] = [];

    await mapWithConcurrency(pending, 10, async (row) => {
      try {
        await addContactToSegment(row.resendContactId, parsedInput.segmentId);
        await db
          .update(newsletterContact)
          .set({
            segments: sql`coalesce(${newsletterContact.segments}, '[]'::jsonb) || ${JSON.stringify([parsedInput.segmentId])}::jsonb`,
            syncedAt: new Date(),
          })
          .where(
            and(
              eq(newsletterContact.id, row.id),
              sql`not (coalesce(${newsletterContact.segments}, '[]'::jsonb) @> ${JSON.stringify([parsedInput.segmentId])}::jsonb)`,
            ),
          );
        added++;
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
      }
    });

    revalidatePath("/newsletter/audience");
    return {
      added,
      skipped: rows.length - pending.length,
      failed: failures.length,
      firstError: failures[0] ?? null,
      simulated: 0,
      mode: "live" as const,
    };
  });
