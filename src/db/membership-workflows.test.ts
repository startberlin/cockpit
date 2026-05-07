import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BoardRosterSetup } from "@/lib/authority/board-roster";

process.env.DATABASE_URL ??= "postgres://user:password@localhost:5432/test";
process.env.BETTER_AUTH_SECRET ??= "test-secret";
process.env.GOOGLE_CLIENT_ID ??= "test-client-id";
process.env.GOOGLE_CLIENT_SECRET ??= "test-client-secret";
process.env.RESEND_API_KEY ??= "test-resend-key";
process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64 ??= "test-credentials";
process.env.SLACK_SIGNING_SECRET ??= "test-slack-secret";
process.env.NEXT_PUBLIC_COCKPIT_URL ??= "https://cockpit.example.com";

const now = new Date("2026-05-04T12:00:00.000Z");

const boardSetup: BoardRosterSetup = {
  ok: true,
  legalOfficerIds: ["usr_president", "usr_vp", "usr_finance"],
  officers: {
    presidentId: "usr_president",
    vicePresidentId: "usr_vp",
    headOfFinanceId: "usr_finance",
  },
};

async function workflowModule() {
  return await import("./membership-workflows");
}

async function legalMembershipModule() {
  return await import("./legal-membership");
}

describe("legal membership classification", () => {
  it("does not grant active legal membership from operational status alone", async () => {
    const { classifyImportedLegalMembership } = await legalMembershipModule();

    assert.deepEqual(
      classifyImportedLegalMembership({
        userStatus: "member",
        documents: "documents_missing_or_unsure",
      }),
      {
        state: "not_member",
        documentStatus: "missing_or_unsure",
      },
    );

    assert.deepEqual(
      classifyImportedLegalMembership({
        userStatus: "supporting_alumni",
        documents: null,
      }),
      {
        state: "not_member",
        documentStatus: "missing_or_unsure",
      },
    );
  });

  it("activates document-verified member imports and marks alumni as former members", async () => {
    const { classifyImportedLegalMembership } = await legalMembershipModule();

    assert.deepEqual(
      classifyImportedLegalMembership({
        userStatus: "member",
        documents: "documents_verified",
      }),
      {
        state: "active_member",
        documentStatus: "verified",
      },
    );

    assert.deepEqual(
      classifyImportedLegalMembership({
        userStatus: "alumni",
      }),
      {
        state: "former_member",
        documentStatus: "not_required",
      },
    );
  });
});

describe("membership workflow records", () => {
  it("creates an admission workflow with board participants in metadata", async () => {
    const { admissionWorkflowValues } = await workflowModule();

    const workflow = admissionWorkflowValues({
      affectedUserId: "usr_affected",
      createdByUserId: "usr_admin",
      boardSetup,
      resolutionText: "Admit Ada Lovelace as a member.",
      resolutionTextVersion: "2026-05-04",
      resolutionTextHash: "sha256:test",
      now,
    });

    assert.match(workflow.id, /^wfl_/);
    assert.equal(workflow.kind, "membership_admission");
    assert.equal(workflow.status, "open");
    assert.equal(workflow.subjectUserId, "usr_affected");
    assert.equal(workflow.metadata.step, "board_resolution");
    assert.deepEqual(
      workflow.metadata.board.participants.map(
        ({ userId, officerFunction, vote }) => ({
          userId,
          officerFunction,
          vote,
        }),
      ),
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

  it("fails closed when board roster setup is not ready", async () => {
    const { admissionWorkflowValues, BoardRosterSetupError } =
      await workflowModule();

    assert.throws(
      () =>
        admissionWorkflowValues({
          affectedUserId: "usr_affected",
          boardSetup: {
            ok: false,
            reason: "invalid_legal_officer_count",
            count: 2,
          },
          resolutionText: "Admit Ada Lovelace as a member.",
          resolutionTextVersion: "2026-05-04",
          resolutionTextHash: "sha256:test",
          now,
        }),
      BoardRosterSetupError,
    );
  });

  it("builds payment setup workflows for document-verified legal members", async () => {
    const { paymentSetupWorkflowValues } = await workflowModule();

    const workflow = paymentSetupWorkflowValues({
      affectedUserId: "usr_affected",
      createdByUserId: "usr_admin",
      now,
    });

    assert.equal(workflow.kind, "membership_payment_setup");
    assert.equal(workflow.subjectUserId, "usr_affected");
    assert.equal(workflow.metadata.step, "payment_required");
  });

  it("records board votes inside admission metadata", async () => {
    const { admissionWorkflowValues, recordAdmissionBoardVote } =
      await workflowModule();
    const workflow = admissionWorkflowValues({
      affectedUserId: "usr_affected",
      boardSetup,
      resolutionText: "Admit Ada Lovelace as a member.",
      resolutionTextVersion: "2026-05-04",
      resolutionTextHash: "sha256:test",
      now,
    });

    const metadata = recordAdmissionBoardVote(workflow.metadata, {
      voterUserId: "usr_president",
      value: "yes",
      displayedTextHash: "sha256:displayed-text",
      decidedAt: now.toISOString(),
    });

    assert.equal(metadata.step, "board_resolution");
    assert.equal(metadata.board.participants[0]?.vote?.value, "yes");
  });

  it("advances to application after two yes votes and no objection", async () => {
    const { admissionWorkflowValues, recordAdmissionBoardVote } =
      await workflowModule();
    const workflow = admissionWorkflowValues({
      affectedUserId: "usr_affected",
      boardSetup,
      resolutionText: "Admit Ada Lovelace as a member.",
      resolutionTextVersion: "2026-05-04",
      resolutionTextHash: "sha256:test",
      now,
    });

    const firstVote = recordAdmissionBoardVote(workflow.metadata, {
      voterUserId: "usr_president",
      value: "yes",
      displayedTextHash: "sha256:displayed-text",
      decidedAt: now.toISOString(),
    });
    const secondVote = recordAdmissionBoardVote(firstVote, {
      voterUserId: "usr_vp",
      value: "yes",
      displayedTextHash: "sha256:displayed-text",
      decidedAt: now.toISOString(),
    });

    assert.equal(secondVote.step, "application");
  });

  it("stores application snapshots and legal documents in metadata", async () => {
    const { admissionWorkflowValues, submitAdmissionApplication } =
      await workflowModule();
    const workflow = admissionWorkflowValues({
      affectedUserId: "usr_affected",
      boardSetup,
      resolutionText: "Admit Ada Lovelace as a member.",
      resolutionTextVersion: "2026-05-04",
      resolutionTextHash: "sha256:test",
      now,
    });

    const metadata = submitAdmissionApplication(workflow.metadata, {
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
          driveUrl: "https://drive.example/document",
        },
      ],
      submittedAt: now.toISOString(),
    });

    assert.equal(metadata.step, "payment_setup");
    assert.equal(metadata.application?.feeAcknowledged, true);
    assert.equal(
      metadata.application?.documents[0]?.kind,
      "membership_application_document",
    );
  });
});
