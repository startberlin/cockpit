import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { user } from "@/db/schema/auth";
import { userOrganizationPosition } from "@/db/schema/authority";
import { activeAuthorityStatuses } from "@/lib/authority/model";
import { isJobboardNotificationPosition } from "@/lib/permissions/evaluate";
import type { JobContent } from "../lib/contracts";
import {
  jobboardSubmissionNotification as notification,
  jobboardSubmission as submission,
} from "./schema";

/** Called in the same transaction that created the submission. */
export async function queueSubmissionNotifications<
  TSchema extends Record<string, unknown>,
>(
  tx: Pick<NodePgDatabase<TSchema>, "select" | "insert">,
  submissionId: string,
  createdAt: Date,
  emailEnabled: boolean,
) {
  const positions = await tx
    .select({
      userId: user.id,
      position: userOrganizationPosition.position,
      scope: userOrganizationPosition.scope,
      department: userOrganizationPosition.department,
    })
    .from(userOrganizationPosition)
    .innerJoin(user, eq(user.id, userOrganizationPosition.userId))
    .where(inArray(user.status, [...activeAuthorityStatuses]));
  const recipients = new Set(
    positions
      .filter(isJobboardNotificationPosition)
      .map(({ userId }) => userId),
  );
  if (recipients.size) {
    await tx
      .insert(notification)
      .values(
        [...recipients].map((userId) => ({
          userId,
          submissionId,
          createdAt,
          emailStatus: emailEnabled
            ? ("pending" as const)
            : ("disabled" as const),
          emailNextActionAt: emailEnabled ? createdAt : null,
        })),
      )
      .onConflictDoNothing({
        target: [notification.userId, notification.submissionId],
      });
  }
}

const PAGE_SIZE = 25;

export function createJobboardNotifications<
  TSchema extends Record<string, unknown>,
>(db: NodePgDatabase<TSchema>) {
  const owned = (userId: string, submissionId: string) =>
    and(
      eq(notification.userId, userId),
      eq(notification.submissionId, submissionId),
    );
  return {
    async unreadCount(userId: string) {
      const [row] = await db
        .select({ total: count() })
        .from(notification)
        .where(
          and(eq(notification.userId, userId), isNull(notification.readAt)),
        );
      return row.total;
    },
    async list(userId: string, page: number) {
      const pageIndex = Number.isSafeInteger(page) && page > 0 ? page - 1 : 0;
      if (!Number.isSafeInteger(pageIndex * PAGE_SIZE))
        return { items: [], hasNext: false };
      const rows = await db
        .select({
          submissionId: notification.submissionId,
          createdAt: notification.createdAt,
          readAt: notification.readAt,
          title: sql<string>`${submission.payload}->'job'->>'title'`,
          company: sql<string>`${submission.payload}->'company'->>'name'`,
        })
        .from(notification)
        .innerJoin(submission, eq(submission.id, notification.submissionId))
        .where(eq(notification.userId, userId))
        .orderBy(desc(notification.createdAt), desc(notification.submissionId))
        .limit(PAGE_SIZE + 1)
        .offset(pageIndex * PAGE_SIZE);
      return {
        items: rows.slice(0, PAGE_SIZE),
        hasNext: rows.length > PAGE_SIZE,
      };
    },
    async detail(userId: string, submissionId: string) {
      const [item] = await db
        .select({
          submissionId: notification.submissionId,
          createdAt: notification.createdAt,
          readAt: notification.readAt,
          status: submission.status,
          company: sql<{
            name: string;
          }>`jsonb_build_object('name', ${submission.payload}->'company'->>'name')`,
          job: sql<JobContent>`${submission.payload}->'job'`,
        })
        .from(notification)
        .innerJoin(submission, eq(submission.id, notification.submissionId))
        .where(owned(userId, submissionId))
        .limit(1);
      return item ?? null;
    },
    async markRead(userId: string, submissionId: string) {
      const [ownedNotification] = await db
        .update(notification)
        .set({ readAt: sql`coalesce(${notification.readAt}, now())` })
        .where(owned(userId, submissionId))
        .returning({ id: notification.submissionId });
      return Boolean(ownedNotification);
    },
  };
}
