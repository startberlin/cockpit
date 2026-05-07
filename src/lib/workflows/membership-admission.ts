import { z } from "zod";
import { globalOrganizationPositions } from "@/lib/authority/model";

export const membershipAdmissionWorkflowKind = "membership_admission" as const;
export const legalBoardDecisionRule = "two_of_three_no_objection" as const;

const nonEmptyString = z.string().min(1);
const legalOfficerFunctionSchema = z.enum(globalOrganizationPositions);

export const boardVoteValueSchema = z.enum([
  "yes",
  "no",
  "abstain",
  "procedure_objection",
]);

const boardVoteSchema = z.object({
  value: boardVoteValueSchema,
  decidedAt: nonEmptyString,
  displayedTextHash: nonEmptyString,
});

const boardParticipantSchema = z.object({
  userId: nonEmptyString,
  officerFunction: legalOfficerFunctionSchema,
  vote: boardVoteSchema.nullable().default(null),
});

const documentReferenceSchema = z
  .object({
    kind: z.enum([
      "board_resolution_document",
      "membership_application_document",
      "admission_confirmation_document",
    ]),
    sha256: nonEmptyString,
    driveFileId: nonEmptyString.nullable().optional(),
    driveUrl: nonEmptyString.nullable().optional(),
    renderer: nonEmptyString.optional(),
    renderedAt: nonEmptyString.optional(),
  })
  .refine((document) => Boolean(document.driveFileId ?? document.driveUrl), {
    message: "Document reference must include a Drive file id or URL.",
    path: ["driveFileId"],
  });

const addressSchema = z.object({
  street: nonEmptyString,
  city: nonEmptyString,
  state: z.string().nullable().optional(),
  zip: nonEmptyString,
  country: nonEmptyString,
});

export const membershipApplicationSnapshotSchema = z.object({
  address: addressSchema,
  declarations: z.record(z.string(), z.unknown()),
  feeAcknowledged: z.literal(true),
  applicationVersion: nonEmptyString,
  feeTextVersion: nonEmptyString,
  submittedAt: nonEmptyString,
  documents: z.array(documentReferenceSchema).default([]),
});

const paymentContextSchema = z.object({
  required: z.boolean(),
  setupStartedAt: z.string().nullable().optional(),
  setupCompletedAt: z.string().nullable().optional(),
});

export const membershipAdmissionMetadataSchema = z
  .object({
    subjectUserId: nonEmptyString,
    proposedByUserId: z.string().nullable().default(null),
    billingApplies: z.boolean().default(true),
    step: z.enum([
      "board_resolution",
      "application",
      "payment_setup",
      "completed",
      "manual_followup",
    ]),
    board: z.object({
      decisionRule: z.literal(legalBoardDecisionRule),
      resolutionText: nonEmptyString,
      resolutionTextVersion: nonEmptyString,
      resolutionTextHash: nonEmptyString,
      participants: z.array(boardParticipantSchema),
    }),
    application: membershipApplicationSnapshotSchema.nullable().default(null),
    payment: paymentContextSchema.nullable().default(null),
  })
  .superRefine((metadata, ctx) => {
    const participants = metadata.board.participants;
    const officerFunctions = new Set(
      participants.map((participant) => participant.officerFunction),
    );
    const userIds = new Set(
      participants.map((participant) => participant.userId),
    );

    if (participants.length !== globalOrganizationPositions.length) {
      ctx.addIssue({
        code: "custom",
        message:
          "Membership admission must snapshot exactly three board participants.",
        path: ["board", "participants"],
      });
    }

    if (officerFunctions.size !== globalOrganizationPositions.length) {
      ctx.addIssue({
        code: "custom",
        message:
          "Membership admission must include one president, one vice president, and one head of finance.",
        path: ["board", "participants"],
      });
    }

    if (userIds.size !== participants.length) {
      ctx.addIssue({
        code: "custom",
        message:
          "Membership admission board participants must be unique users.",
        path: ["board", "participants"],
      });
    }
  });

export type MembershipAdmissionMetadata = z.infer<
  typeof membershipAdmissionMetadataSchema
>;
export type BoardVoteValue = z.infer<typeof boardVoteValueSchema>;
export type MembershipApplicationSnapshot = z.infer<
  typeof membershipApplicationSnapshotSchema
>;

export function createMembershipAdmissionMetadata({
  subjectUserId,
  proposedByUserId,
  billingApplies = true,
  resolutionText,
  resolutionTextVersion,
  resolutionTextHash,
  boardParticipants,
}: {
  subjectUserId: string;
  proposedByUserId?: string | null;
  billingApplies?: boolean;
  resolutionText: string;
  resolutionTextVersion: string;
  resolutionTextHash: string;
  boardParticipants: Array<{
    userId: string;
    officerFunction: z.infer<typeof legalOfficerFunctionSchema>;
  }>;
}) {
  return membershipAdmissionMetadataSchema.parse({
    subjectUserId,
    proposedByUserId: proposedByUserId ?? null,
    billingApplies,
    step: "board_resolution",
    board: {
      decisionRule: legalBoardDecisionRule,
      resolutionText,
      resolutionTextVersion,
      resolutionTextHash,
      participants: boardParticipants.map((participant) => ({
        ...participant,
        vote: null,
      })),
    },
    application: null,
    payment: billingApplies ? { required: true } : null,
  });
}

export function recordBoardVoteInMetadata(
  metadata: unknown,
  {
    voterUserId,
    value,
    displayedTextHash,
    decidedAt = new Date().toISOString(),
  }: {
    voterUserId: string;
    value: BoardVoteValue;
    displayedTextHash: string;
    decidedAt?: string;
  },
) {
  const parsed = membershipAdmissionMetadataSchema.parse(metadata);

  if (parsed.step !== "board_resolution") {
    throw new Error(
      `Board votes can only be recorded at the "board_resolution" step, but current step is "${parsed.step}".`,
    );
  }

  if (displayedTextHash !== parsed.board.resolutionTextHash) {
    throw new Error(
      "Board vote displayedTextHash does not match the stored resolution text hash.",
    );
  }

  const participant = parsed.board.participants.find(
    ({ userId }) => userId === voterUserId,
  );

  if (!participant) {
    throw new Error(
      "Board vote can only be recorded for a workflow participant.",
    );
  }

  const participants = parsed.board.participants.map((current) =>
    current.userId === voterUserId
      ? {
          ...current,
          vote: {
            value,
            displayedTextHash,
            decidedAt,
          },
        }
      : current,
  );

  const votes = participants.map(({ vote }) => vote?.value);
  const hasProcedureObjection = votes.includes("procedure_objection");
  const yesVotes = votes.filter((vote) => vote === "yes").length;
  const step = hasProcedureObjection
    ? "manual_followup"
    : yesVotes >= 2
      ? "application"
      : parsed.step;

  return membershipAdmissionMetadataSchema.parse({
    ...parsed,
    step,
    board: {
      ...parsed.board,
      participants,
    },
  });
}

export function submitApplicationInMetadata(
  metadata: unknown,
  application: Omit<MembershipApplicationSnapshot, "submittedAt"> & {
    submittedAt?: string;
  },
) {
  const parsed = membershipAdmissionMetadataSchema.parse(metadata);

  if (parsed.step !== "application") {
    throw new Error(
      `Application can only be submitted from the "application" step, but current step is "${parsed.step}".`,
    );
  }

  const submittedApplication = membershipApplicationSnapshotSchema.parse({
    ...application,
    submittedAt: application.submittedAt ?? new Date().toISOString(),
  });

  return membershipAdmissionMetadataSchema.parse({
    ...parsed,
    step: parsed.billingApplies ? "payment_setup" : "completed",
    application: submittedApplication,
  });
}
