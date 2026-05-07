import { createMembershipPaymentSetupMetadata } from "@/lib/workflows";
import { workflowValues } from "./workflows";

export function paymentSetupWorkflowValues({
  affectedUserId,
  createdByUserId,
  billingApplies = true,
  now = new Date(),
}: {
  affectedUserId: string;
  createdByUserId?: string | null;
  billingApplies?: boolean;
  now?: Date;
}) {
  return workflowValues({
    kind: "membership_payment_setup",
    status: "open",
    subjectUserId: affectedUserId,
    createdByUserId: createdByUserId ?? null,
    metadata: createMembershipPaymentSetupMetadata({
      subjectUserId: affectedUserId,
      createdByUserId: createdByUserId ?? null,
      billingApplies,
    }),
    now,
  });
}
