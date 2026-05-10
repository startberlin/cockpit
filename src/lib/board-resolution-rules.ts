import type { BoardVoteValue } from "@/db/schema/board-admission";

export type { BoardVoteValue };

export type VoteOutcome = "approved" | "manual_followup" | "pending";

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
