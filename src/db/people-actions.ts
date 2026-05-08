import { and, eq, inArray } from "drizzle-orm";
import db from ".";
import type { UserStatus } from "./schema/auth";
import { user } from "./schema/auth";
import {
  admissionParticipant,
  boardResolution,
  boardVote,
} from "./schema/board-admission";
import { legalMembership } from "./schema/legal-membership";

export interface PendingBoardAction {
  legalMembershipId: string;
  subjectUserId: string;
  subjectName: string;
  subjectOperationalStatus: UserStatus;
  resolutionId: string;
}

export async function getPendingBoardActionsForUser(
  userId: string,
): Promise<PendingBoardAction[]> {
  // Find legalMembership IDs where current user is an admission participant
  const participantTenures = await db
    .select({ legalMembershipId: admissionParticipant.legalMembershipId })
    .from(admissionParticipant)
    .where(eq(admissionParticipant.userId, userId));

  if (participantTenures.length === 0) return [];

  const tenureIds = participantTenures.map((p) => p.legalMembershipId);

  // Find which tenures the user has already voted on
  const votedTenures = await db
    .select({ legalMembershipId: boardVote.legalMembershipId })
    .from(boardVote)
    .where(
      and(
        eq(boardVote.voterUserId, userId),
        inArray(boardVote.legalMembershipId, tenureIds),
      ),
    );

  const votedTenureIds = new Set(votedTenures.map((v) => v.legalMembershipId));
  const pendingTenureIds = tenureIds.filter((id) => !votedTenureIds.has(id));

  if (pendingTenureIds.length === 0) return [];

  // Load pending tenures that are in admission_pending status
  // with the subject user and board resolution
  const rows = await db
    .select({
      legalMembershipId: legalMembership.id,
      subjectUserId: user.id,
      subjectFirstName: user.firstName,
      subjectLastName: user.lastName,
      subjectOperationalStatus: user.status,
      resolutionId: boardResolution.id,
    })
    .from(legalMembership)
    .innerJoin(user, eq(user.id, legalMembership.userId))
    .innerJoin(
      boardResolution,
      eq(boardResolution.legalMembershipId, legalMembership.id),
    )
    .where(
      and(
        eq(legalMembership.status, "admission_pending"),
        inArray(legalMembership.id, pendingTenureIds),
      ),
    );

  return rows.map((row) => ({
    legalMembershipId: row.legalMembershipId,
    subjectUserId: row.subjectUserId,
    subjectName: `${row.subjectFirstName} ${row.subjectLastName}`,
    subjectOperationalStatus: row.subjectOperationalStatus,
    resolutionId: row.resolutionId,
  }));
}
