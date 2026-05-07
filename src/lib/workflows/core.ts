import { z } from "zod";
import {
  type MembershipAdmissionMetadata,
  membershipAdmissionMetadataSchema,
  membershipAdmissionWorkflowKind,
} from "./membership-admission";
import {
  type MembershipPaymentSetupMetadata,
  membershipPaymentSetupMetadataSchema,
  membershipPaymentSetupWorkflowKind,
} from "./membership-payment-setup";

export const workflowStatusSchema = z.enum([
  "open",
  "completed",
  "manual_followup",
  "cancelled",
]);

export type WorkflowStatus = z.infer<typeof workflowStatusSchema>;

export const workflowKindSchema = z.enum([
  membershipAdmissionWorkflowKind,
  membershipPaymentSetupWorkflowKind,
]);

export type WorkflowKind = z.infer<typeof workflowKindSchema>;

export type WorkflowMetadataByKind = {
  membership_admission: MembershipAdmissionMetadata;
  membership_payment_setup: MembershipPaymentSetupMetadata;
};

export function parseWorkflowKind(kind: string): WorkflowKind {
  return workflowKindSchema.parse(kind);
}

function assertNever(value: never): never {
  throw new Error(`Unsupported workflow kind: ${value}`);
}

export function parseWorkflowMetadata<K extends WorkflowKind>(
  kind: K,
  metadata: unknown,
): WorkflowMetadataByKind[K] {
  const parsedKind = parseWorkflowKind(kind);

  switch (parsedKind) {
    case "membership_admission":
      return membershipAdmissionMetadataSchema.parse(
        metadata,
      ) as WorkflowMetadataByKind[K];
    case "membership_payment_setup":
      return membershipPaymentSetupMetadataSchema.parse(
        metadata,
      ) as WorkflowMetadataByKind[K];
    default:
      return assertNever(parsedKind);
  }
}

export function parseWorkflowRecord({
  kind,
  metadata,
}: {
  kind: string;
  metadata: unknown;
}) {
  const parsedKind = parseWorkflowKind(kind);
  return {
    kind: parsedKind,
    metadata: parseWorkflowMetadata(parsedKind, metadata),
  };
}
