"use server";

import { eq } from "drizzle-orm";
import db from "@/db";
import { actionClient } from "@/lib/action-client";
import { newsletterIssue } from "../db/schema";
import { assertNewsletterAccess } from "../lib/access";
import {
  isAiConfigured,
  suggestPreviewText,
  suggestSubjectLines,
} from "../lib/ai";
import { renderIssue } from "../lib/render";
import { issueIdSchema, suggestPreviewTextSchema } from "./schemas";

/**
 * The plain-text rendering of the issue is what gets sent to the model — the
 * same text a recipient would read, with no markup and, crucially, nothing from
 * the wider Cockpit database.
 */
async function issueContext(id: string) {
  const [issue] = await db
    .select()
    .from(newsletterIssue)
    .where(eq(newsletterIssue.id, id))
    .limit(1);
  if (!issue) throw new Error("Issue not found.");

  const { text } = await renderIssue({
    subject: issue.subject,
    previewText: issue.previewText,
    blocks: issue.blocks,
  });

  return { issue, text };
}

export const suggestSubjectsAction = actionClient
  .inputSchema(issueIdSchema)
  .action(async ({ parsedInput }) => {
    await assertNewsletterAccess();
    if (!isAiConfigured()) {
      throw new Error("Writing help is off: OPENAI_API_KEY is not set.");
    }

    const { text } = await issueContext(parsedInput.id);
    return { suggestions: await suggestSubjectLines(text) };
  });

export const suggestPreviewTextAction = actionClient
  .inputSchema(suggestPreviewTextSchema)
  .action(async ({ parsedInput }) => {
    await assertNewsletterAccess();
    if (!isAiConfigured()) {
      throw new Error("Writing help is off: OPENAI_API_KEY is not set.");
    }

    const { text } = await issueContext(parsedInput.id);
    return {
      options: await suggestPreviewText(text, parsedInput.subject),
    };
  });
