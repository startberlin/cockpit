import { and, eq, inArray } from "drizzle-orm";
import type { BoardRosterSetup } from "@/lib/authority/board-roster";
import db from ".";
import {
  activeAdmissionWorkflowStatuses,
  admissionWorkflowValues,
} from "./membership-admission-workflows";
import { paymentSetupWorkflowValues } from "./membership-payment-workflows";
import { workflow } from "./schema/workflow";

export {
  activeAdmissionWorkflowStatuses,
  admissionWorkflowValues,
  BoardRosterSetupError,
  legalOfficerSnapshotsFromBoardSetup,
  recordAdmissionBoardVote,
  submitAdmissionApplication,
} from "./membership-admission-workflows";
export { paymentSetupWorkflowValues } from "./membership-payment-workflows";

export async function findActiveAdmissionWorkflow(affectedUserId: string) {
  return db.query.workflow.findFirst({
    where: and(
      eq(workflow.subjectUserId, affectedUserId),
      eq(workflow.kind, "membership_admission"),
      inArray(workflow.status, activeAdmissionWorkflowStatuses),
    ),
  });
}

export async function createAdmissionWorkflow(input: {
  affectedUserId: string;
  createdByUserId?: string | null;
  boardSetup: BoardRosterSetup;
  resolutionText: string;
  resolutionTextVersion: string;
  resolutionTextHash: string;
  billingApplies?: boolean;
}) {
  const existing = await findActiveAdmissionWorkflow(input.affectedUserId);
  if (existing) {
    return { workflow: existing, reused: true };
  }

  const [createdWorkflow] = await db
    .insert(workflow)
    .values(admissionWorkflowValues(input))
    .returning();

  return { workflow: createdWorkflow, reused: false };
}

export async function createPaymentSetupWorkflow(input: {
  affectedUserId: string;
  createdByUserId?: string | null;
  billingApplies?: boolean;
}) {
  const [createdWorkflow] = await db
    .insert(workflow)
    .values(paymentSetupWorkflowValues(input))
    .returning();

  return { workflow: createdWorkflow };
}
