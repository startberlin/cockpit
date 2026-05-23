import { and, eq, sql } from "drizzle-orm";
import db from ".";
import type { UserStatus } from "./schema/auth";
import type { BoardVote } from "./schema/legal-membership";
import { legalMembership } from "./schema/legal-membership";

export interface PendingBoardAction {
  legalMembershipId: string;
  subjectUserId: string;
  subjectName: string;
  subjectOperationalStatus: UserStatus;
}

export async function getPendingBoardActionsForUser(
  userId: string,
): Promise<PendingBoardAction[]> {
  // Find legalMemberships where the user is in boardParticipants JSON array
  // and the status is admission_pending.
  const tenures = await db
    .select({
      id: legalMembership.id,
      userId: legalMembership.userId,
      boardVotes: legalMembership.boardVotes,
    })
    .from(legalMembership)
    .where(
      and(
        eq(legalMembership.status, "admission_pending"),
        sql`${legalMembership.boardParticipants} @> ${JSON.stringify([{ userId }])}::jsonb`,
      ),
    );

  if (tenures.length === 0) return [];

  // Filter out tenures where the user has already voted.
  const pendingTenures = tenures.filter((t) => {
    const votes: BoardVote[] = t.boardVotes ?? [];
    return !votes.some((v) => v.voterUserId === userId);
  });

  if (pendingTenures.length === 0) return [];

  const subjectUserIds = pendingTenures.map((t) => t.userId);
  const subjectUsers = await db.query.user.findMany({
    where: (u, { inArray: inArrayFn }) => inArrayFn(u.id, subjectUserIds),
    columns: { id: true, firstName: true, lastName: true, status: true },
  });

  const userById = new Map(subjectUsers.map((u) => [u.id, u]));

  return pendingTenures.map((tenure) => {
    const subjectUser = userById.get(tenure.userId);
    return {
      legalMembershipId: tenure.id,
      subjectUserId: tenure.userId,
      subjectName: subjectUser
        ? `${subjectUser.firstName} ${subjectUser.lastName}`.trim()
        : tenure.userId,
      subjectOperationalStatus: subjectUser?.status ?? "onboarding",
    };
  });
}
