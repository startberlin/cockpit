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
  listAllContacts,
  listContactTopicSubscriptions,
  listTopics,
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
 * Check fresh membership and global subscription status for live broadcasts.
 */
export interface PreflightProblem {
  code: string;
  message: string;
}

async function preflight(
  issue: typeof newsletterIssue.$inferSelect,
  html: string,
  checkTopicRecipients = false,
) {
  const problems: PreflightProblem[] = [];
  const segmentId = issue.segmentId ?? env.RESEND_NEWSLETTER_SEGMENT_ID;
  const topicId = issue.topicId ?? env.RESEND_NEWSLETTER_TOPIC_ID ?? null;
  const configured = isResendConfigured();
  const live = sendMode() === "live";

  if (!configured) {
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

  if (!segmentId) {
    problems.push({
      code: "no-segment",
      message: "No segment is configured for this issue.",
    });
  }

  let recipients = 0;
  if (!configured) return { problems, recipients, segmentId, topicId };

  const [segment, topics] = await Promise.allSettled([
    segmentId && live ? listAllContacts({ segmentId }) : null,
    topicId ? listTopics() : null,
  ]);
  const subscribedContacts =
    segment.status === "fulfilled"
      ? (segment.value?.filter((contact) => !contact.unsubscribed) ?? [])
      : [];

  if (segment.status === "rejected") {
    problems.push({
      code: "segment-lookup-failed",
      message: "Could not check the selected segment in Resend. Try again.",
    });
  } else if (segmentId) {
    recipients = live
      ? subscribedContacts.length
      : await countSyncedSegmentMembers(segmentId);
    if (recipients === 0) {
      problems.push({
        code: "empty-segment",
        message: "That segment has no subscribed contacts.",
      });
    }
  }

  if (topics.status === "rejected") {
    problems.push({
      code: "topic-lookup-failed",
      message: "Could not check the selected topic in Resend. Try again.",
    });
  } else if (topicId && !topics.value?.some((topic) => topic.id === topicId)) {
    problems.push({
      code: "invalid-topic",
      message: "That topic no longer exists in Resend. Choose another topic.",
    });
  }

  if (checkTopicRecipients && live && topicId && problems.length === 0) {
    try {
      if (!(await hasTopicRecipient(subscribedContacts, topicId))) {
        problems.push({
          code: "empty-topic",
          message:
            "Nobody in that segment is subscribed to the selected topic.",
        });
      }
    } catch {
      problems.push({
        code: "topic-recipients-lookup-failed",
        message: "Could not verify topic subscriptions in Resend. Try again.",
      });
    }
  }

  return { problems, recipients, segmentId, topicId };
}

async function countSyncedSegmentMembers(segmentId: string): Promise<number> {
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

/** A single eligible contact is enough to rule out an empty broadcast. */
async function hasTopicRecipient(
  contacts: { id: string }[],
  topicId: string,
): Promise<boolean> {
  const batchSize = 8;
  let hasUnknownPreference = false;
  for (let start = 0; start < contacts.length; start += batchSize) {
    const preferences = await Promise.all(
      contacts.slice(start, start + batchSize).map(async (contact) => {
        const topics = await listContactTopicSubscriptions(contact.id);
        return topics[topicId];
      }),
    );
    if (preferences.includes("opt_in")) return true;
    if (preferences.some((preference) => preference !== "opt_out"))
      hasUnknownPreference = true;
  }
  if (hasUnknownPreference)
    throw new Error("Resend returned incomplete topic subscriptions.");
  return false;
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
    let segmentId: string;
    let topicId: string | null;
    try {
      ({ html, text } = await renderIssue({
        subject: issue.subject,
        previewText: issue.previewText,
        blocks: issue.blocks,
      }));
      const audience = await preflight(issue, html, true);
      if (!audience.segmentId || audience.problems.length) {
        await releaseClaim();
        return { ok: false as const, problems: audience.problems };
      }
      segmentId = audience.segmentId;
      topicId = audience.topicId;
    } catch (error) {
      await releaseClaim();
      throw error;
    }

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
 * Checks the selected audience without sending. The live dispatch also
 * verifies there is at least one eligible recipient for the chosen topic.
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
    if (parsedInput.topicId !== undefined) {
      issue.topicId = parsedInput.topicId || null;
    }

    const { html } = await renderIssue({
      subject: issue.subject,
      previewText: issue.previewText,
      blocks: issue.blocks,
    });

    return preflight(issue, html);
  });
