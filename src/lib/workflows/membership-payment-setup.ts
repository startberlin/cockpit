import { z } from "zod";

export const membershipPaymentSetupWorkflowKind =
  "membership_payment_setup" as const;

export const membershipPaymentSetupMetadataSchema = z.object({
  subjectUserId: z.string().min(1),
  createdByUserId: z.string().nullable().default(null),
  reason: z.literal("membership_payment_setup"),
  billingApplies: z.boolean().default(true),
  step: z.literal("payment_required"),
});

export type MembershipPaymentSetupMetadata = z.infer<
  typeof membershipPaymentSetupMetadataSchema
>;

export function createMembershipPaymentSetupMetadata({
  subjectUserId,
  createdByUserId,
  billingApplies = true,
}: {
  subjectUserId: string;
  createdByUserId?: string | null;
  billingApplies?: boolean;
}) {
  return membershipPaymentSetupMetadataSchema.parse({
    subjectUserId,
    createdByUserId: createdByUserId ?? null,
    reason: "membership_payment_setup",
    billingApplies,
    step: "payment_required",
  });
}
