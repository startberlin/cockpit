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

export const workflowKindSchema = z.enum([
  membershipAdmissionWorkflowKind,
  membershipPaymentSetupWorkflowKind,
]);

export type WorkflowKind = z.infer<typeof workflowKindSchema>;

export type WorkflowMetadataByKind = {
  membership_admission: MembershipAdmissionMetadata;
  membership_payment_setup: MembershipPaymentSetupMetadata;
};

function assertNever(value: never): never {
  throw new Error(`Unsupported workflow kind: ${value}`);
}

export function parseWorkflowMetadata<K extends WorkflowKind>(
  kind: K,
  metadata: unknown,
): WorkflowMetadataByKind[K] {
  const parsedKind = workflowKindSchema.parse(kind);

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
