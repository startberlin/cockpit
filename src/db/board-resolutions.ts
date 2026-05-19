import "server-only";

import { eq } from "drizzle-orm";
import db from ".";
import type { UserStatus } from "./schema/auth";
import { user } from "./schema/auth";
import type {
  BoardVote,
  BoardVoteValue,
  LegalMembershipStatus,
  OfficerFunction,
} from "./schema/legal-membership";
import { legalMembership } from "./schema/legal-membership";

export interface ResolutionDetail {
  legalMembershipId: string;
  status: LegalMembershipStatus;
  resolutionText: string;
  resolutionTextHash: string;
  subject: { id: string; name: string; status: UserStatus };
  participants: Array<{
    userId: string;
    name: string;
    officerFunction: OfficerFunction;
    vote: { value: BoardVoteValue; castAt: Date } | null;
  }>;
}

export async function getResolutionDetail(
  legalMembershipId: string,
): Promise<ResolutionDetail | null> {
  const row = await db
    .select({
      id: legalMembership.id,
      status: legalMembership.status,
      boardResolutionText: legalMembership.boardResolutionText,
      boardResolutionHash: legalMembership.boardResolutionHash,
      boardParticipants: legalMembership.boardParticipants,
      boardVotes: legalMembership.boardVotes,
      subjectId: user.id,
      subjectFirstName: user.firstName,
      subjectLastName: user.lastName,
      subjectStatus: user.status,
    })
    .from(legalMembership)
    .innerJoin(user, eq(user.id, legalMembership.userId))
    .where(eq(legalMembership.id, legalMembershipId))
    .then((rows) => rows[0] ?? null);

  if (!row) return null;

  if (!row.boardResolutionText || !row.boardResolutionHash) return null;

  const participants = row.boardParticipants ?? [];
  const votes: BoardVote[] = row.boardVotes ?? [];

  const votesByVoter = new Map(
    votes.map((v) => [
      v.voterUserId,
      { value: v.value, castAt: new Date(v.castAt) },
    ]),
  );

  // Resolve participant names: we need user records for each participant.
  const participantUserIds = participants.map((p) => p.userId);
  const participantUsers =
    participantUserIds.length > 0
      ? await db.query.user.findMany({
          where: (u, { inArray }) => inArray(u.id, participantUserIds),
          columns: { id: true, firstName: true, lastName: true },
        })
      : [];

  const userNameById = new Map(
    participantUsers.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]),
  );

  return {
    legalMembershipId: row.id,
    status: row.status,
    resolutionText: row.boardResolutionText,
    resolutionTextHash: row.boardResolutionHash,
    subject: {
      id: row.subjectId,
      name: `${row.subjectFirstName} ${row.subjectLastName}`.trim(),
      status: row.subjectStatus,
    },
    participants: participants.map((p) => ({
      userId: p.userId,
      name: userNameById.get(p.userId) ?? p.userId,
      officerFunction: p.officerFunction,
      vote: votesByVoter.get(p.userId) ?? null,
    })),
  };
}
