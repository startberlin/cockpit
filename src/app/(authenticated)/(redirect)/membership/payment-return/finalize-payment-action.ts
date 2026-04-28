"use server";

import { getCurrentUser } from "@/db/user";
import { reconcileMembershipPaymentForUser } from "@/lib/gocardless/membership-reconciliation";

export async function finalizeMembershipPaymentAction({
  billingRequestFlowId,
}: {
  billingRequestFlowId?: string | null;
}) {
  const user = await getCurrentUser();

  if (!user) {
    return {
      status: "failed" as const,
      message: "Please sign in again before finalizing your membership.",
    };
  }

  try {
    return await reconcileMembershipPaymentForUser({
      userId: user.id,
      billingRequestFlowId,
    });
  } catch (error) {
    console.error("Failed to finalize GoCardless membership payment", error);

    return {
      status: "failed" as const,
      message:
        "We could not finish setting up your membership payment. Please try again.",
    };
  }
}
