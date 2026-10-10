import "server-only";

import { and, eq, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import db from "@/db";
import { can } from "@/lib/permissions/server";
import { newsletterIssue } from "../db/schema";
import { broadcastStatus } from "./broadcast-status";
import { getBroadcast, isResendConfigured } from "./resend";

// Longer than a Cockpit request can run on Vercel. An unrecorded broadcast
// cannot have been dispatched: its durable reference is required before send.
const UNRECORDED_DISPATCH_TIMEOUT_MS = 15 * 60_000;

/** Reconcile only in-flight issues, using read-only requests to Resend. */
export async function syncIssueStatuses(id?: string): Promise<void> {
  if (!(await can("apps.newsletter.access"))) return;
  await db
    .update(newsletterIssue)
    .set({
      status: "failed",
      dispatchStartedAt: null,
      lastError:
        "Sending stopped before a broadcast was recorded. No email was dispatched. Edit a copy to try again.",
    })
    .where(
      and(
        id ? eq(newsletterIssue.id, id) : undefined,
        eq(newsletterIssue.status, "sending"),
        isNull(newsletterIssue.resendBroadcastId),
        lt(
          newsletterIssue.dispatchStartedAt,
          new Date(Date.now() - UNRECORDED_DISPATCH_TIMEOUT_MS),
        ),
      ),
    );
  const issues = await db
    .select({
      id: newsletterIssue.id,
      status: newsletterIssue.status,
      broadcastId: newsletterIssue.resendBroadcastId,
      scheduledAt: newsletterIssue.scheduledAt,
      updatedAt: newsletterIssue.updatedAt,
      lastError: newsletterIssue.lastError,
    })
    .from(newsletterIssue)
    .where(
      and(
        id ? eq(newsletterIssue.id, id) : undefined,
        inArray(newsletterIssue.status, ["scheduled", "sending"]),
        isNotNull(newsletterIssue.resendBroadcastId),
      ),
    );

  for (let offset = 0; offset < issues.length; offset += 4) {
    await Promise.all(
      issues.slice(offset, offset + 4).map(async (issue) => {
        if (!issue.broadcastId) return;
        try {
          let next: {
            status:
              | "scheduled"
              | "sending"
              | "sent"
              | "canceled"
              | "draft"
              | "failed";
            sentAt: Date | null;
          };
          if (issue.broadcastId.startsWith("sandbox_")) {
            if (issue.scheduledAt && issue.scheduledAt.getTime() > Date.now())
              return;
            next = { status: "sent", sentAt: issue.scheduledAt ?? new Date() };
          } else {
            if (!isResendConfigured()) return;
            const remote = await getBroadcast(issue.broadcastId);
            if (!remote) return;
            const status = broadcastStatus(
              remote.status,
              remote.scheduled_at,
              Date.now(),
              issue.status,
            );
            if (!status || (status === issue.status && !issue.lastError))
              return;
            next = {
              status,
              sentAt: remote.sent_at ? new Date(remote.sent_at) : null,
            };
          }
          // A concurrent cancellation wins over a response fetched before it.
          await db
            .update(newsletterIssue)
            .set({ ...next, dispatchStartedAt: null, lastError: null })
            .where(
              and(
                eq(newsletterIssue.id, issue.id),
                eq(newsletterIssue.status, issue.status),
                eq(newsletterIssue.resendBroadcastId, issue.broadcastId),
                sql`date_trunc('milliseconds', ${newsletterIssue.updatedAt}) = ${issue.updatedAt.toISOString()}::timestamp`,
              ),
            );
        } catch (error) {
          console.error(
            `[newsletter] Could not refresh issue ${issue.id}`,
            error,
          );
        }
      }),
    );
  }
}
