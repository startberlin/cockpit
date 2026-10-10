"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import db from "@/db";
import { actionClient } from "@/lib/action-client";
import { newId } from "@/lib/id";
import { newsletterIssue } from "../db/schema";
import { assertNewsletterAccess } from "../lib/access";
import { renderIssue } from "../lib/render";
import {
  createIssueSchema,
  issueIdSchema,
  renderPreviewSchema,
  updateIssueSchema,
} from "./schemas";

/**
 * The route layout's `requireAppAccess()` guards page renders only — server
 * actions are independently addressable endpoints, so every one of them
 * re-checks for itself.
 */

export const createIssueAction = actionClient
  .inputSchema(createIssueSchema)
  .action(async ({ parsedInput, ctx: { user } }) => {
    await assertNewsletterAccess();

    const id = newId("newsletterIssue");
    const now = new Date();
    await db.insert(newsletterIssue).values({
      id,
      name: parsedInput.name,
      createdBy: user.id,
      // Drizzle reads these timezone-less columns as UTC. Database now() would
      // instead store wall time when Postgres runs in Europe/Berlin.
      createdAt: now,
      updatedAt: now,
    });

    revalidatePath("/newsletter");
    return { id };
  });

export const updateIssueAction = actionClient
  .inputSchema(updateIssueSchema)
  .action(async ({ parsedInput }) => {
    await assertNewsletterAccess();

    // Even two writes within the same millisecond must advance the revision.
    const expectedUpdatedAt = new Date(parsedInput.expectedUpdatedAt);
    const updatedAt = new Date(
      Math.max(Date.now(), expectedUpdatedAt.getTime() + 1),
    );

    const [saved] = await db
      .update(newsletterIssue)
      .set({
        name: parsedInput.name,
        subject: parsedInput.subject,
        previewText: parsedInput.previewText,
        blocks: parsedInput.blocks,
        updatedAt,
      })
      .where(
        and(
          eq(newsletterIssue.id, parsedInput.id),
          eq(newsletterIssue.status, "draft"),
          // Existing database defaults may include microseconds, which a JS
          // Date cannot retain. Compare at the precision exposed to the editor.
          sql`date_trunc('milliseconds', ${newsletterIssue.updatedAt}) = ${expectedUpdatedAt.toISOString()}::timestamp`,
        ),
      )
      .returning({ updatedAt: newsletterIssue.updatedAt });

    if (!saved)
      return {
        conflict: true as const,
        message:
          "This issue changed in another tab or is no longer a draft. Reload it before saving. Your local edits have been kept.",
      };

    // Deliberately no `revalidatePath`. This is the autosave: revalidating
    // re-renders the composer's own route as part of the action response, which
    // remounts the editor and throws away everything it is holding — including
    // the rendered preview and which blocks are collapsed. The client is
    // already the source of truth for what it just sent, and the issue list is
    // rendered dynamically, so it picks up the change on the next visit anyway.
    return { conflict: false as const, savedAt: saved.updatedAt.toISOString() };
  });

export const deleteIssueAction = actionClient
  .inputSchema(issueIdSchema)
  .action(async ({ parsedInput }) => {
    await assertNewsletterAccess();

    const [removed] = await db
      .delete(newsletterIssue)
      .where(
        and(
          eq(newsletterIssue.id, parsedInput.id),
          inArray(newsletterIssue.status, ["draft", "canceled", "failed"]),
        ),
      )
      .returning({ id: newsletterIssue.id });

    if (!removed)
      throw new Error(
        "Cancel a scheduled send before deleting it. Sent issues must be kept.",
      );

    revalidatePath("/newsletter");
  });

/**
 * Copies an issue into a fresh draft.
 *
 * The whole point of a monthly newsletter is that most of its structure repeats.
 * Starting each edition from last month's — same sections, same order — and
 * replacing the content is the actual workflow, so it should not require
 * rebuilding the layout from an empty page every time.
 */
export const duplicateIssueAction = actionClient
  .inputSchema(issueIdSchema)
  .action(async ({ parsedInput, ctx: { user } }) => {
    await assertNewsletterAccess();

    const [source] = await db
      .select()
      .from(newsletterIssue)
      .where(eq(newsletterIssue.id, parsedInput.id))
      .limit(1);
    if (!source) throw new Error("Issue not found.");

    const id = newId("newsletterIssue");
    const now = new Date();
    await db.insert(newsletterIssue).values({
      id,
      name: `${source.name.slice(0, 113)} (copy)`,
      subject: source.subject,
      previewText: source.previewText,
      // Fresh block ids: they key React lists and the drag-and-drop sort, so
      // two issues sharing them would be a subtle mess if both were ever open.
      blocks: source.blocks.map((block) => ({
        ...structuredClone(block),
        id: crypto.randomUUID(),
      })),
      fromAddress: source.fromAddress,
      replyTo: source.replyTo,
      segmentId: source.segmentId,
      topicId: source.topicId,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    });

    revalidatePath("/newsletter");
    return { id };
  });

/**
 * Renders the composer's live preview. Runs on the server through the exact
 * pipeline used for the real send, so the preview cannot drift from the result.
 */
export const renderPreviewAction = actionClient
  .inputSchema(renderPreviewSchema)
  .action(async ({ parsedInput }) => {
    await assertNewsletterAccess();

    const { html, htmlBytes } = await renderIssue({
      subject: parsedInput.subject,
      previewText: parsedInput.previewText,
      blocks: parsedInput.blocks,
    });

    return { html, htmlBytes };
  });
