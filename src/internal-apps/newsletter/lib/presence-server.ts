import "server-only";

import { and, count, eq, gt, ne, sql } from "drizzle-orm";
import db from "@/db";
import { user } from "@/db/schema/auth";
import { newsletterIssue, newsletterIssueEditor } from "../db/schema";
import {
  type EditorPresence,
  PRESENCE_CHANGE_WINDOW_MS,
  PRESENCE_TTL_MS,
} from "./issue-presence";

export class PresenceRequestError extends Error {
  constructor(
    message: string,
    readonly status: 404 | 409,
  ) {
    super(message);
  }
}

interface PresenceSession {
  issueId: string;
  editorSessionId: string;
  userId: string;
}

export async function heartbeatIssuePresence({
  issueId,
  editorSessionId,
  userId,
  isChanging,
}: PresenceSession & { isChanging: boolean }): Promise<{
  editors: EditorPresence[];
  checkedAt: string;
}> {
  return db.transaction(async (tx) => {
    // Hold the draft status stable while registering, without changing its
    // revision or blocking other presence reads.
    const [issue] = await tx
      .select({
        status: newsletterIssue.status,
        checkedAt: sql<string>`now()::text`,
      })
      .from(newsletterIssue)
      .where(eq(newsletterIssue.id, issueId))
      .for("share")
      .limit(1);
    if (!issue) throw new PresenceRequestError("Issue not found.", 404);
    if (issue.status !== "draft") {
      throw new PresenceRequestError("This issue is no longer a draft.", 409);
    }

    // Bound cleanup and skip rows another heartbeat has locked. Cleanup before
    // upsert avoids two expired sessions waiting for each other's updates.
    await tx.execute(sql`
      delete from ${newsletterIssueEditor}
      where (${newsletterIssueEditor.issueId}, ${newsletterIssueEditor.editorSessionId}) in (
        select ${newsletterIssueEditor.issueId}, ${newsletterIssueEditor.editorSessionId}
        from ${newsletterIssueEditor}
        where ${newsletterIssueEditor.lastSeenAt} < now() - ${PRESENCE_TTL_MS} * interval '1 millisecond'
        order by ${newsletterIssueEditor.lastSeenAt}
        limit 100
        for update skip locked
      )
    `);

    const [registered] = await tx
      .insert(newsletterIssueEditor)
      .values({
        issueId,
        editorSessionId,
        userId,
        lastSeenAt: sql`now()`,
        changedAt: isChanging ? sql`now()` : null,
      })
      .onConflictDoUpdate({
        target: [
          newsletterIssueEditor.issueId,
          newsletterIssueEditor.editorSessionId,
        ],
        set: {
          lastSeenAt: sql`now()`,
          changedAt: isChanging ? sql`now()` : null,
        },
        where: eq(newsletterIssueEditor.userId, userId),
      })
      .returning({ userId: newsletterIssueEditor.userId });
    if (!registered) {
      throw new PresenceRequestError(
        "That editor session belongs to another user.",
        409,
      );
    }

    const editors = await tx
      .select({
        userId: user.id,
        name: user.name,
        sessionCount: count(),
        isChanging: sql<boolean>`coalesce(bool_or(${newsletterIssueEditor.changedAt} > now() - ${PRESENCE_CHANGE_WINDOW_MS} * interval '1 millisecond'), false)`,
      })
      .from(newsletterIssueEditor)
      .innerJoin(user, eq(newsletterIssueEditor.userId, user.id))
      .where(
        and(
          eq(newsletterIssueEditor.issueId, issueId),
          ne(newsletterIssueEditor.editorSessionId, editorSessionId),
          gt(
            newsletterIssueEditor.lastSeenAt,
            sql`now() - ${PRESENCE_TTL_MS} * interval '1 millisecond'`,
          ),
        ),
      )
      .groupBy(user.id, user.name)
      .orderBy(user.name);
    return { editors, checkedAt: new Date(issue.checkedAt).toISOString() };
  });
}

export async function releaseIssuePresence({
  issueId,
  editorSessionId,
  userId,
}: PresenceSession): Promise<void> {
  await db
    .delete(newsletterIssueEditor)
    .where(
      and(
        eq(newsletterIssueEditor.issueId, issueId),
        eq(newsletterIssueEditor.editorSessionId, editorSessionId),
        eq(newsletterIssueEditor.userId, userId),
      ),
    );
}
