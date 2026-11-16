"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import db from "@/db";
import { actionClient } from "@/lib/action-client";
import { newsletterContact } from "../db/schema";
import { assertNewsletterAccess } from "../lib/access";
import { addContactToSegment, sendMode } from "../lib/resend";
import { mapWithConcurrency, syncAudience } from "../lib/sync-audience";
import { assignSegmentSchema } from "./schemas";

export const syncContactsAction = actionClient.action(async () => {
  await assertNewsletterAccess();
  const result = await syncAudience();
  revalidatePath("/newsletter/audience");
  return result;
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
