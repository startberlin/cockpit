"use server";

import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { returnValidationErrors } from "next-safe-action";
import db from "@/db";
import { env } from "@/env";
import { actionClient } from "@/lib/action-client";
import { newsletterContact, newsletterIssue } from "../db/schema";
import { assertNewsletterAccess } from "../lib/access";
import { isBlockEmpty } from "../lib/block-summary";
import { DEFAULT_NEWSLETTER_FROM } from "../lib/config";
import {
  hasUnsubscribeLink,
  renderIssue,
  substituteMergeTags,
} from "../lib/render";
import {
  type CreateBroadcastResult,
  cancelBroadcast,
  createAndSendBroadcast,
  isResendConfigured,
  listSegments,
  sendMode,
  sendTestEmail,
} from "../lib/resend";
import {
  issueIdSchema,
  preflightSchema,
  scheduleIssueSchema,
  sendTestSchema,
} from "./schemas";

async function loadIssue(id: string) {
  const [issue] = await db
    .select()
    .from(newsletterIssue)
    .where(eq(newsletterIssue.id, id))
    .limit(1);
  if (!issue) throw new Error("Issue not found.");
  return issue;
}

const REVISION_CONFLICT_MESSAGE =
  "This issue changed in another tab or is no longer a draft. Reload it before sending. Your local edits have been kept.";

/**
 * Everything that must be true before an issue may leave the building.
 *
 * Resend accepts broadcasts to empty segments and delivers them to nobody.
 * Membership is read from the local mirror to keep checks fast and consistent
 * with the Audience page.
 * Refresh segment membership there when the remote audience has changed.
 */
export interface PreflightProblem {
  code: string;
  message: string;
}

async function preflight(
  issue: typeof newsletterIssue.$inferSelect,
  html: string,
  recipientCount?: number,
): Promise<PreflightProblem[]> {
  const problems: PreflightProblem[] = [];

  if (!isResendConfigured()) {
    problems.push({
      code: "no-api-key",
      message: "RESEND_API_KEY is not set.",
    });
  }
  if (!issue.subject.trim()) {
    problems.push({
      code: "no-subject",
      message: "The issue has no subject line.",
    });
  }
  if (
    !issue.blocks.some(
      (block) => block.kind !== "divider" && !isBlockEmpty(block),
    )
  ) {
    problems.push({ code: "no-blocks", message: "The issue has no content." });
  }
  if (!hasUnsubscribeLink(html)) {
    problems.push({
      code: "no-unsubscribe",
      message: "The rendered email has no unsubscribe link.",
    });
  }

  const segmentId = issue.segmentId ?? env.RESEND_NEWSLETTER_SEGMENT_ID;
  if (!segmentId) {
    problems.push({
      code: "no-segment",
      message: "No segment is configured for this issue.",
    });
  } else {
    const recipients = recipientCount ?? (await countSegmentMembers(segmentId));
    if (recipients === 0) {
      problems.push({
        code: "empty-segment",
        message:
          "That segment has no contacts. Sync from Resend, then use “Add contacts to segment” on the Audience page.",
      });
    }
  }

  return problems;
}

async function countSegmentMembers(segmentId: string): Promise<number> {
  const [result] = await db
    .select({ total: count() })
    .from(newsletterContact)
    .where(
      and(
        eq(newsletterContact.unsubscribed, false),
        sql`${newsletterContact.segments} @> ${JSON.stringify([segmentId])}::jsonb`,
      ),
    );
  return result.total;
}

export const sendTestAction = actionClient
  .inputSchema(sendTestSchema)
  .action(async ({ parsedInput }) => {
    await assertNewsletterAccess();
    const issue = await loadIssue(parsedInput.id);
    if (
      issue.updatedAt.getTime() !==
      new Date(parsedInput.expectedUpdatedAt).getTime()
    ) {
      returnValidationErrors(sendTestSchema, {
        _errors: [REVISION_CONFLICT_MESSAGE],
      });
    }

    const { html, text } = await renderIssue({
      subject: issue.subject,
      previewText: issue.previewText,
      blocks: issue.blocks,
    });

    // The `/emails` endpoint does not interpolate contact variables the way a
    // broadcast does, so a raw merge tag would arrive verbatim.
    const resolvedHtml = substituteMergeTags(html, {
      firstName: "there",
      unsubscribeUrl: `${env.NEXT_PUBLIC_COCKPIT_URL}/newsletter`,
    });

    const id = await sendTestEmail({
      from: issue.fromAddress ?? DEFAULT_NEWSLETTER_FROM,
      to: parsedInput.recipients,
      subject: `[Test] ${issue.subject || issue.name}`,
      html: resolvedHtml,
      text: substituteMergeTags(text, {
        firstName: "there",
        unsubscribeUrl: `${env.NEXT_PUBLIC_COCKPIT_URL}/newsletter`,
      }),
      replyTo: issue.replyTo,
    });

    return { id, mode: sendMode(), recipients: parsedInput.recipients.length };
  });

export const scheduleIssueAction = actionClient
  .inputSchema(scheduleIssueSchema)
  .action(async ({ parsedInput }) => {
    await assertNewsletterAccess();
    // Claim the latest saved draft atomically. Two tabs must never dispatch it
    // twice, and an autosave must not overwrite content after the claim.
    const confirmed = {
      fromAddress:
        parsedInput.fromAddress === undefined
          ? undefined
          : parsedInput.fromAddress || null,
      replyTo:
        parsedInput.replyTo === undefined
          ? undefined
          : parsedInput.replyTo || null,
      segmentId:
        parsedInput.segmentId === undefined
          ? undefined
          : parsedInput.segmentId || null,
      topicId:
        parsedInput.topicId === undefined
          ? undefined
          : parsedInput.topicId || null,
    };

    const [issue] = await db
      .update(newsletterIssue)
      .set({
        ...confirmed,
        status: "sending",
        dispatchStartedAt: new Date(),
        lastError: null,
        updatedAt: newsletterIssue.updatedAt,
      })
      .where(
        and(
          eq(newsletterIssue.id, parsedInput.id),
          eq(newsletterIssue.status, "draft"),
          sql`date_trunc('milliseconds', ${newsletterIssue.updatedAt}) = ${new Date(parsedInput.expectedUpdatedAt).toISOString()}::timestamp`,
        ),
      )
      .returning();
    if (!issue)
      returnValidationErrors(scheduleIssueSchema, {
        _errors: [REVISION_CONFLICT_MESSAGE],
      });

    async function releaseClaim() {
      await db
        .update(newsletterIssue)
        .set({
          status: "draft",
          dispatchStartedAt: null,
          updatedAt: newsletterIssue.updatedAt,
        })
        .where(
          and(
            eq(newsletterIssue.id, issue.id),
            eq(newsletterIssue.status, "sending"),
            isNull(newsletterIssue.resendBroadcastId),
          ),
        );
    }

    let html: string;
    let text: string;
    try {
      ({ html, text } = await renderIssue({
        subject: issue.subject,
        previewText: issue.previewText,
        blocks: issue.blocks,
      }));
      const problems = await preflight(issue, html);
      if (problems.length) {
        await releaseClaim();
        return { ok: false as const, problems };
      }
    } catch (error) {
      await releaseClaim();
      throw error;
    }

    const segmentId = (issue.segmentId ??
      env.RESEND_NEWSLETTER_SEGMENT_ID) as string;
    const topicId = issue.topicId ?? env.RESEND_NEWSLETTER_TOPIC_ID ?? null;
    const scheduledAt = parsedInput.scheduledAt?.trim()
      ? parsedInput.scheduledAt
      : null;

    if (scheduledAt && Date.parse(scheduledAt) <= Date.now()) {
      await releaseClaim();
      return {
        ok: false as const,
        problems: [
          { code: "past-time", message: "Choose a send time in the future." },
        ],
      };
    }

    let recordedBroadcast: CreateBroadcastResult | null = null;
    try {
      const result = await createAndSendBroadcast(
        {
          name: issue.name,
          segmentId,
          topicId,
          from: issue.fromAddress ?? DEFAULT_NEWSLETTER_FROM,
          replyTo: issue.replyTo,
          subject: issue.subject,
          previewText: issue.previewText,
          html,
          text,
          scheduledAt,
        },
        async (broadcast) => {
          const [recorded] = await db
            .update(newsletterIssue)
            .set({
              resendBroadcastId: broadcast.broadcastId,
              sendMode: broadcast.mode,
              segmentId,
              topicId,
              fromAddress: issue.fromAddress ?? DEFAULT_NEWSLETTER_FROM,
              scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
            })
            .where(
              and(
                eq(newsletterIssue.id, issue.id),
                eq(newsletterIssue.status, "sending"),
                isNull(newsletterIssue.resendBroadcastId),
              ),
            )
            .returning({ id: newsletterIssue.id });
          if (!recorded)
            throw new Error("The issue changed before it could be sent.");
          recordedBroadcast = broadcast;
        },
      );

      let status: "scheduled" | "sent" | "sending" = "sending";
      if (scheduledAt) status = "scheduled";
      else if (result.mode === "sandbox") status = "sent";

      await db
        .update(newsletterIssue)
        .set({
          status,
          dispatchStartedAt: null,
          sentAt: !scheduledAt && result.mode === "sandbox" ? new Date() : null,
          lastError: null,
        })
        .where(
          and(
            eq(newsletterIssue.id, issue.id),
            eq(newsletterIssue.status, "sending"),
            eq(newsletterIssue.resendBroadcastId, result.broadcastId),
          ),
        );
    } catch (error) {
      // The provider may have accepted a dispatch before its response was lost.
      // Keep its recorded ID in flight so polling can reconcile the outcome.
      await db
        .update(newsletterIssue)
        .set({
          status: recordedBroadcast ? "sending" : "failed",
          lastError: error instanceof Error ? error.message : String(error),
        })
        .where(
          and(
            eq(newsletterIssue.id, issue.id),
            eq(newsletterIssue.status, "sending"),
          ),
        );
      revalidatePath("/newsletter");
      revalidatePath(`/newsletter/issues/${issue.id}`);
      throw error;
    }

    revalidatePath("/newsletter");
    revalidatePath(`/newsletter/issues/${issue.id}`);
    return { ok: true as const, mode: sendMode(), scheduled: !!scheduledAt };
  });

export const cancelIssueAction = actionClient
  .inputSchema(issueIdSchema)
  .action(async ({ parsedInput }) => {
    await assertNewsletterAccess();
    const issue = await loadIssue(parsedInput.id);

    if (!issue.resendBroadcastId) throw new Error("Nothing to cancel.");
    if (issue.status !== "scheduled" && issue.status !== "sending") {
      throw new Error("Only a scheduled or sending issue can be canceled.");
    }

    await cancelBroadcast(issue.resendBroadcastId);

    await db
      .update(newsletterIssue)
      .set({ status: "canceled" })
      .where(
        and(
          eq(newsletterIssue.id, issue.id),
          eq(newsletterIssue.resendBroadcastId, issue.resendBroadcastId),
          inArray(newsletterIssue.status, ["scheduled", "sending"]),
        ),
      );

    revalidatePath("/newsletter");
    revalidatePath(`/newsletter/issues/${issue.id}`);
  });

/**
 * Runs the same checks the send path runs, without sending, and reports who the
 * issue would reach.
 *
 * Called when the schedule dialog opens so objections appear before someone
 * picks a time, rather than after they commit.
 */
export const preflightAction = actionClient
  .inputSchema(preflightSchema)
  .action(async ({ parsedInput }) => {
    await assertNewsletterAccess();
    const issue = await loadIssue(parsedInput.id);
    if (
      issue.updatedAt.getTime() !==
      new Date(parsedInput.expectedUpdatedAt).getTime()
    ) {
      returnValidationErrors(preflightSchema, {
        _errors: [REVISION_CONFLICT_MESSAGE],
      });
    }

    // A segment picked in the dialog but not yet saved still has to produce an
    // accurate count, otherwise the number on screen describes the previous
    // choice.
    if (parsedInput.segmentId !== undefined) {
      issue.segmentId = parsedInput.segmentId || null;
    }

    const { html } = await renderIssue({
      subject: issue.subject,
      previewText: issue.previewText,
      blocks: issue.blocks,
    });

    const segmentId = issue.segmentId ?? env.RESEND_NEWSLETTER_SEGMENT_ID;
    const recipients = segmentId ? await countSegmentMembers(segmentId) : 0;

    let segmentName: string | null = null;
    if (segmentId && isResendConfigured()) {
      try {
        const segments = (await listSegments()) as {
          id: string;
          name: string;
        }[];
        segmentName = segments.find((s) => s.id === segmentId)?.name ?? null;
      } catch {
        // A missing name is cosmetic; the counts and the checks still stand.
      }
    }

    return {
      problems: await preflight(issue, html, recipients),
      recipients,
      segmentName,
      fromAddress: issue.fromAddress ?? DEFAULT_NEWSLETTER_FROM,
      subject: issue.subject,
      previewText: issue.previewText,
    };
  });
