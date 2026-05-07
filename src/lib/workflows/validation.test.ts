import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ZodError } from "zod";
import {
  createMembershipAdmissionMetadata,
  parseWorkflowMetadata,
  recordBoardVoteInMetadata,
  submitApplicationInMetadata,
} from ".";

const boardParticipants = [
  { userId: "usr_president", officerFunction: "president" as const },
  { userId: "usr_vp", officerFunction: "vice_president" as const },
  { userId: "usr_finance", officerFunction: "head_of_finance" as const },
];

function admissionMetadata() {
  return createMembershipAdmissionMetadata({
    subjectUserId: "usr_affected",
    proposedByUserId: "usr_admin",
    resolutionText: "Admit Ada Lovelace as a member.",
    resolutionTextVersion: "2026-05-04",
    resolutionTextHash: "sha256:resolution",
    boardParticipants,
  });
}

describe("workflow metadata schemas", () => {
  it("parses membership admission metadata with board participants", () => {
    const metadata = admissionMetadata();

    assert.equal(metadata.subjectUserId, "usr_affected");
    assert.equal(metadata.step, "board_resolution");
    assert.equal(metadata.board.decisionRule, "two_of_three_no_objection");
    assert.deepEqual(
      metadata.board.participants.map(({ userId, officerFunction, vote }) => ({
        userId,
        officerFunction,
        vote,
      })),
      [
        { userId: "usr_president", officerFunction: "president", vote: null },
        { userId: "usr_vp", officerFunction: "vice_president", vote: null },
        {
          userId: "usr_finance",
          officerFunction: "head_of_finance",
          vote: null,
        },
      ],
    );
  });

  it("rejects unknown workflow kinds", () => {
    assert.throws(
      () =>
        parseWorkflowMetadata("reimbursement_request" as never, {
          subjectUserId: "usr_affected",
        }),
      ZodError,
    );
  });

  it("rejects invalid board vote values", () => {
    assert.throws(
      () =>
        recordBoardVoteInMetadata(admissionMetadata(), {
          voterUserId: "usr_president",
          value: "maybe" as never,
          displayedTextHash: "sha256:resolution",
        }),
      ZodError,
    );
  });

  it("rejects admission metadata without subject user context", () => {
    const metadata = admissionMetadata();
    const { subjectUserId: _subjectUserId, ...withoutSubjectUser } = metadata;

    assert.throws(
      () => parseWorkflowMetadata("membership_admission", withoutSubjectUser),
      ZodError,
    );
  });

  it("advances board approval after two yes votes and no objection", () => {
    const firstVote = recordBoardVoteInMetadata(admissionMetadata(), {
      voterUserId: "usr_president",
      value: "yes",
      displayedTextHash: "sha256:resolution",
      decidedAt: "2026-05-04T12:00:00.000Z",
    });
    const secondVote = recordBoardVoteInMetadata(firstVote, {
      voterUserId: "usr_vp",
      value: "yes",
      displayedTextHash: "sha256:resolution",
      decidedAt: "2026-05-04T12:01:00.000Z",
    });

    assert.equal(secondVote.step, "application");
  });

  it("moves procedure objections to manual follow-up", () => {
    const updated = recordBoardVoteInMetadata(admissionMetadata(), {
      voterUserId: "usr_president",
      value: "procedure_objection",
      displayedTextHash: "sha256:resolution",
    });

    assert.equal(updated.step, "manual_followup");
  });

  it("rejects votes from users outside the stored board roster", () => {
    assert.throws(
      () =>
        recordBoardVoteInMetadata(admissionMetadata(), {
          voterUserId: "usr_outsider",
          value: "yes",
          displayedTextHash: "sha256:resolution",
        }),
      /workflow participant/,
    );
  });

  it("stores application snapshots and document references in metadata", () => {
    const afterFirstVote = recordBoardVoteInMetadata(admissionMetadata(), {
      voterUserId: "usr_president",
      value: "yes",
      displayedTextHash: "sha256:resolution",
      decidedAt: "2026-05-04T12:00:00.000Z",
    });
    const afterApproval = recordBoardVoteInMetadata(afterFirstVote, {
      voterUserId: "usr_vp",
      value: "yes",
      displayedTextHash: "sha256:resolution",
      decidedAt: "2026-05-04T12:01:00.000Z",
    });
    const updated = submitApplicationInMetadata(afterApproval, {
      address: {
        street: "Main Street 1",
        city: "Berlin",
        zip: "10115",
        country: "DE",
      },
      declarations: { bylawsAccepted: true },
      feeAcknowledged: true,
      applicationVersion: "application:v1",
      feeTextVersion: "fee:v1",
      documents: [
        {
          kind: "membership_application_document",
          sha256: "sha256:document",
          driveFileId: "drive_file_1",
        },
      ],
    });

    assert.equal(updated.step, "payment_setup");
    assert.equal(updated.application?.feeAcknowledged, true);
    assert.equal(updated.application?.documents[0]?.sha256, "sha256:document");
  });

  it("rejects application submission before board approval", () => {
    assert.throws(
      () =>
        submitApplicationInMetadata(admissionMetadata(), {
          address: {
            street: "Main Street 1",
            city: "Berlin",
            zip: "10115",
            country: "DE",
          },
          declarations: { bylawsAccepted: true },
          feeAcknowledged: true,
          applicationVersion: "application:v1",
          feeTextVersion: "fee:v1",
          documents: [],
        }),
      /application.*step/,
    );
  });

  it("rejects application submissions without fee acknowledgement", () => {
    const afterFirstVote = recordBoardVoteInMetadata(admissionMetadata(), {
      voterUserId: "usr_president",
      value: "yes",
      displayedTextHash: "sha256:resolution",
      decidedAt: "2026-05-04T12:00:00.000Z",
    });
    const afterApproval = recordBoardVoteInMetadata(afterFirstVote, {
      voterUserId: "usr_vp",
      value: "yes",
      displayedTextHash: "sha256:resolution",
      decidedAt: "2026-05-04T12:01:00.000Z",
    });
    assert.throws(
      () =>
        submitApplicationInMetadata(afterApproval, {
          address: {
            street: "Main Street 1",
            city: "Berlin",
            zip: "10115",
            country: "DE",
          },
          declarations: { bylawsAccepted: true },
          feeAcknowledged: false as never,
          applicationVersion: "application:v1",
          feeTextVersion: "fee:v1",
          documents: [],
        }),
      ZodError,
    );
  });
});
