import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { z } from "zod";
import { user } from "@/db/schema/auth";
import { userOrganizationPosition } from "@/db/schema/authority";
import { isActiveAuthorityStatus } from "@/lib/authority/model";
import { isJobboardNotificationPosition } from "@/lib/permissions/evaluate";
import {
  jobboardSubmissionNotification as notification,
  jobboardSubmission as submission,
} from "./schema";

type EmailIdentity = { userId: string; submissionId: string };
export type JobboardEmailClaim = EmailIdentity & {
  token: string;
  email: string;
  companyName: string;
  jobTitle: string;
};
export type JobboardEmailOutcome =
  | "accepted"
  | "uncertain"
  | "rejected"
  | "disabled";

const MAX_ATTEMPTS = 3;
const CLAIM_TIMEOUT_MS = 15 * 60_000;
const accountEmail = z.email();
const identity = (key: EmailIdentity) =>
  and(
    eq(notification.userId, key.userId),
    eq(notification.submissionId, key.submissionId),
  );
const ownedClaim = (claim: JobboardEmailClaim) =>
  and(
    identity(claim),
    eq(notification.emailStatus, "sending"),
    eq(notification.emailClaimToken, claim.token),
  );

export function createJobboardEmailQueue<
  TSchema extends Record<string, unknown>,
>(db: NodePgDatabase<TSchema>, clock: () => Date = () => new Date()) {
  async function claimNext(): Promise<
    JobboardEmailClaim | "uncertain" | "skipped" | null
  > {
    return db.transaction(async (tx) => {
      const now = clock();
      const [row] = await tx
        .select({
          userId: notification.userId,
          submissionId: notification.submissionId,
          emailStatus: notification.emailStatus,
          email: user.email,
          emailVerified: user.emailVerified,
          userStatus: user.status,
          companyName: sql<string>`${submission.payload}->'company'->>'name'`,
          jobTitle: sql<string>`${submission.payload}->'job'->>'title'`,
        })
        .from(notification)
        .innerJoin(submission, eq(submission.id, notification.submissionId))
        .innerJoin(user, eq(user.id, notification.userId))
        .where(
          and(
            inArray(notification.emailStatus, ["pending", "sending"]),
            lte(notification.emailNextActionAt, now),
          ),
        )
        .orderBy(
          asc(notification.emailNextActionAt),
          asc(notification.userId),
          asc(notification.submissionId),
        )
        .limit(1)
        .for("update", { of: notification, skipLocked: true });
      if (!row) return null;

      // SES cannot tell a reclaimed worker whether the previous request was accepted.
      // A lost claim is terminal even if the earlier worker never recorded its result.
      if (row.emailStatus === "sending") {
        await tx
          .update(notification)
          .set({
            emailStatus: "uncertain",
            emailClaimToken: null,
            emailNextActionAt: null,
          })
          .where(identity(row));
        return "uncertain" as const;
      }

      const email = accountEmail.safeParse(row.email?.trim());
      const positions = await tx
        .select({
          position: userOrganizationPosition.position,
          scope: userOrganizationPosition.scope,
          department: userOrganizationPosition.department,
        })
        .from(userOrganizationPosition)
        .where(eq(userOrganizationPosition.userId, row.userId));
      if (
        !row.emailVerified ||
        !email.success ||
        !isActiveAuthorityStatus(row.userStatus) ||
        !positions.some(isJobboardNotificationPosition)
      ) {
        await tx
          .update(notification)
          .set({ emailStatus: "skipped", emailNextActionAt: null })
          .where(identity(row));
        return "skipped" as const;
      }
      const token = randomUUID();
      await tx
        .update(notification)
        .set({
          emailStatus: "sending",
          emailClaimToken: token,
          emailAttempts: sql`${notification.emailAttempts} + 1`,
          emailNextActionAt: new Date(now.getTime() + CLAIM_TIMEOUT_MS),
        })
        .where(identity(row));
      return {
        userId: row.userId,
        submissionId: row.submissionId,
        token,
        email: email.data,
        companyName: row.companyName,
        jobTitle: row.jobTitle,
      };
    });
  }

  async function finish(
    claim: JobboardEmailClaim,
    outcome: JobboardEmailOutcome,
  ) {
    const result = await db
      .update(notification)
      .set({
        emailStatus: outcome,
        emailClaimToken: null,
        emailNextActionAt: null,
      })
      .where(ownedClaim(claim));
    return result.rowCount === 1;
  }

  // Only a definitive provider throttle may put an attempted message back in the queue.
  async function retry(
    claim: JobboardEmailClaim,
    delaySeconds: number,
  ): Promise<"pending" | "exhausted" | "stale"> {
    if (!Number.isSafeInteger(delaySeconds) || delaySeconds < 1) {
      throw new Error("Retry delay must be a positive number of seconds.");
    }
    const nextAttempt = new Date(
      clock().getTime() + delaySeconds * 1000,
    ).toISOString();
    const exhausted = sql`${notification.emailAttempts} >= ${MAX_ATTEMPTS}`;
    const [result] = await db
      .update(notification)
      .set({
        emailStatus: sql`CASE WHEN ${exhausted} THEN 'exhausted' ELSE 'pending' END`,
        emailNextActionAt: sql`CASE WHEN ${exhausted} THEN NULL ELSE ${nextAttempt}::timestamptz END`,
        emailClaimToken: null,
      })
      .where(ownedClaim(claim))
      .returning({ status: notification.emailStatus });
    if (!result) return "stale";
    return result.status === "exhausted" ? "exhausted" : "pending";
  }

  return { claimNext, finish, retry };
}
