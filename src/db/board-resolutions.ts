import "server-only";

import { and, eq } from "drizzle-orm";
import db from ".";
import type { UserStatus } from "./schema/auth";
import { user } from "./schema/auth";
import type { BoardVoteValue, OfficerFunction } from "./schema/board-admission";
import {
  admissionParticipant,
  boardResolution,
  boardVote,
} from "./schema/board-admission";
import type { LegalMembershipStatus } from "./schema/legal-membership";
import { legalMembership } from "./schema/legal-membership";

export interface ResolutionDetail {
  legalMembershipId: string;
  status: LegalMembershipStatus;
  resolutionId: string;
  resolutionText: string;
  resolutionTextHash: string;
  billingApplies: boolean;
  subject: { id: string; name: string; status: UserStatus };
  participants: Array<{
    userId: string;
    name: string;
    officerFunction: OfficerFunction;
    vote: { value: BoardVoteValue; castAt: Date } | null;
  }>;
}

export async function getResolutionDetail(
  resolutionId: string,
): Promise<ResolutionDetail | null> {
  // Join board_resolution → legal_membership → user (subject)
  const rows = await db
    .select({
      legalMembershipId: legalMembership.id,
      status: legalMembership.status,
      resolutionId: boardResolution.id,
      resolutionText: boardResolution.resolutionText,
      resolutionTextHash: boardResolution.resolutionTextHash,
      billingApplies: boardResolution.billingApplies,
      subjectId: user.id,
      subjectFirstName: user.firstName,
      subjectLastName: user.lastName,
      subjectStatus: user.status,
    })
    .from(boardResolution)
    .innerJoin(
      legalMembership,
      eq(legalMembership.id, boardResolution.legalMembershipId),
    )
    .innerJoin(user, eq(user.id, legalMembership.userId))
    .where(eq(boardResolution.id, resolutionId));

  if (rows.length === 0) return null;

  const row = rows[0];

  // Load admission participants joined with their user records
  const participantRows = await db
    .select({
      userId: admissionParticipant.userId,
      officerFunction: admissionParticipant.officerFunction,
      firstName: user.firstName,
      lastName: user.lastName,
    })
    .from(admissionParticipant)
    .innerJoin(user, eq(user.id, admissionParticipant.userId))
    .where(eq(admissionParticipant.legalMembershipId, row.legalMembershipId));

  // Load board votes for this legal membership
  const voteRows = await db
    .select({
      voterUserId: boardVote.voterUserId,
      value: boardVote.value,
      castAt: boardVote.castAt,
    })
    .from(boardVote)
    .where(and(eq(boardVote.legalMembershipId, row.legalMembershipId)));

  const votesByVoter = new Map(
    voteRows.map((v) => [v.voterUserId, { value: v.value, castAt: v.castAt }]),
  );

  const participants = participantRows.map((p) => ({
    userId: p.userId,
    name: `${p.firstName} ${p.lastName}`,
    officerFunction: p.officerFunction,
    vote: votesByVoter.get(p.userId) ?? null,
  }));

  return {
    legalMembershipId: row.legalMembershipId,
    status: row.status,
    resolutionId: row.resolutionId,
    resolutionText: row.resolutionText,
    resolutionTextHash: row.resolutionTextHash,
    billingApplies: row.billingApplies,
    subject: {
      id: row.subjectId,
      name: `${row.subjectFirstName} ${row.subjectLastName}`,
      status: row.subjectStatus,
    },
    participants,
  };
}
