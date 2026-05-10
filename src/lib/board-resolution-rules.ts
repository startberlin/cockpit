import type {
  BoardVoteValue,
  OfficerFunction,
} from "@/db/schema/board-admission";

export type { BoardVoteValue };

export type VoteOutcome = "approved" | "manual_followup" | "pending";

const OFFICER_PRIORITY: Record<OfficerFunction, number> = {
  president: 1,
  vice_president: 2,
  head_of_finance: 3,
};

export interface ResolutionRoles {
  sitzungsleiter: { userId: string; officerFunction: OfficerFunction };
  protokollfuehrer: { userId: string; officerFunction: OfficerFunction };
}

export function computeResolutionRoles(
  participants: Array<{ userId: string; officerFunction: OfficerFunction }>,
  votes: Array<{ voterUserId: string; value: BoardVoteValue }>,
): ResolutionRoles | null {
  const yesVoterIds = new Set(
    votes.filter((v) => v.value === "yes").map((v) => v.voterUserId),
  );

  const yesParticipants = participants
    .filter((p) => yesVoterIds.has(p.userId))
    .sort(
      (a, b) =>
        OFFICER_PRIORITY[a.officerFunction] -
        OFFICER_PRIORITY[b.officerFunction],
    );

  if (yesParticipants.length < 2) {
    return null;
  }

  return {
    sitzungsleiter: yesParticipants[0],
    protokollfuehrer: yesParticipants[1],
  };
}

/**
 * Compute the outcome of a board vote given the votes cast so far.
 *
 * Rules:
 * - Any "procedure_objection" vote → "manual_followup" immediately
 * - ≥ 2 "yes" votes (with no procedure_objection) → "approved"
 * - Otherwise → "pending"
 */
export function computeVoteOutcome(votes: BoardVoteValue[]): VoteOutcome {
  if (votes.some((v) => v === "procedure_objection")) {
    return "manual_followup";
  }

  const yesCount = votes.filter((v) => v === "yes").length;
  if (yesCount >= 2) {
    return "approved";
  }

  return "pending";
}
