"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { MembershipTransitionRequest } from "@/db/membership-transitions";
import { retractCancellationAction } from "./retract-cancellation-action";
import { retractTransitionAction } from "./retract-transition-action";

const RETRACT_LABELS: Record<MembershipTransitionRequest["type"], string> = {
  cancellation: "Withdraw cancellation",
  alumni_request: "Withdraw request",
  supporting_alumni_request: "Withdraw request",
};

export function TransitionWithdrawButton({
  request,
}: {
  request: MembershipTransitionRequest;
}) {
  const router = useRouter();

  const {
    execute: executeCancellationRetract,
    isPending: isCancellationPending,
  } = useAction(retractCancellationAction, {
    onSuccess: () => {
      toast.success("Cancellation request withdrawn.");
      router.refresh();
    },
    onError: () => toast.error("Failed to withdraw request. Please try again."),
  });

  const { execute: executeTransitionRetract, isPending: isTransitionPending } =
    useAction(retractTransitionAction, {
      onSuccess: () => {
        toast.success("Transition request withdrawn.");
        router.refresh();
      },
      onError: () =>
        toast.error("Failed to withdraw request. Please try again."),
    });

  const isPending = isCancellationPending || isTransitionPending;

  function handleRetract() {
    if (request.type === "cancellation") {
      executeCancellationRetract({ requestId: request.id });
    } else {
      executeTransitionRetract({ requestId: request.id });
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRetract}
      disabled={isPending}
    >
      {isPending ? "Withdrawing…" : RETRACT_LABELS[request.type]}
    </Button>
  );
}
