import type { BoardRosterSetup } from "@/lib/authority/board-roster";
import type { GlobalOrganizationPosition } from "@/lib/authority/model";
import {
  type BoardVoteValue,
  createMembershipAdmissionMetadata,
  recordBoardVoteInMetadata,
  submitApplicationInMetadata,
} from "@/lib/workflows";
import type { WorkflowStatus } from "./schema/workflow";
import { workflowValues } from "./workflows";

export const activeAdmissionWorkflowStatuses = [
  "open",
  "manual_followup",
] as const satisfies WorkflowStatus[];

export class BoardRosterSetupError extends Error {
  constructor(public readonly setup: Exclude<BoardRosterSetup, { ok: true }>) {
    super(`Board roster setup is not ready: ${setup.reason}.`);
    this.name = "BoardRosterSetupError";
  }
}

type LegalOfficerSnapshot = {
  userId: string;
  officerFunction: GlobalOrganizationPosition;
};

export function legalOfficerSnapshotsFromBoardSetup(
  setup: BoardRosterSetup,
): LegalOfficerSnapshot[] {
  if (!setup.ok) {
    throw new BoardRosterSetupError(setup);
  }

  return [
    {
      userId: setup.officers.presidentId,
      officerFunction: "president",
    },
    {
      userId: setup.officers.vicePresidentId,
      officerFunction: "vice_president",
    },
    {
      userId: setup.officers.headOfFinanceId,
      officerFunction: "head_of_finance",
    },
  ];
}

export function admissionWorkflowValues({
  affectedUserId,
  createdByUserId,
  boardSetup,
  resolutionText,
  resolutionTextVersion,
  resolutionTextHash,
  billingApplies = true,
  now = new Date(),
}: {
  affectedUserId: string;
  createdByUserId?: string | null;
  boardSetup: BoardRosterSetup;
  resolutionText: string;
  resolutionTextVersion: string;
  resolutionTextHash: string;
  billingApplies?: boolean;
  now?: Date;
}) {
  const boardParticipants = legalOfficerSnapshotsFromBoardSetup(boardSetup);

  return workflowValues({
    kind: "membership_admission",
    status: "open",
    subjectUserId: affectedUserId,
    createdByUserId: createdByUserId ?? null,
    metadata: createMembershipAdmissionMetadata({
      subjectUserId: affectedUserId,
      proposedByUserId: createdByUserId ?? null,
      billingApplies,
      resolutionText,
      resolutionTextVersion,
      resolutionTextHash,
      boardParticipants,
    }),
    now,
  });
}

export function recordAdmissionBoardVote(
  metadata: unknown,
  input: {
    voterUserId: string;
    value: BoardVoteValue;
    displayedTextHash: string;
    decidedAt?: string;
  },
) {
  return recordBoardVoteInMetadata(metadata, input);
}

export function submitAdmissionApplication(
  metadata: unknown,
  input: Parameters<typeof submitApplicationInMetadata>[1],
) {
  return submitApplicationInMetadata(metadata, input);
}
