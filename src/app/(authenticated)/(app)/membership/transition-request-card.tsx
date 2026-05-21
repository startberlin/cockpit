"use client";

import { ClockIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { MembershipTransitionRequest } from "@/db/membership-transitions";
import { retractCancellationAction } from "./retract-cancellation-action";
import { retractTransitionAction } from "./retract-transition-action";

const LABELS: Record<
  MembershipTransitionRequest["type"],
  { title: string; description: string; retractLabel: string }
> = {
  cancellation: {
    title: "Cancellation pending",
    description:
      "Your cancellation request has been submitted and is being reviewed by the board.",
    retractLabel: "Withdraw cancellation",
  },
  alumni_request: {
    title: "Alumni transition pending",
    description:
      "Your request to transition to alumni status is awaiting board approval.",
    retractLabel: "Withdraw request",
  },
  supporting_alumni_request: {
    title: "Supporting alumni request pending",
    description:
      "Your request to become a supporting alumni member is awaiting board approval.",
    retractLabel: "Withdraw request",
  },
};

export function TransitionRequestCard({
  request,
}: {
  request: MembershipTransitionRequest;
}) {
  const router = useRouter();
  const label = LABELS[request.type];

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
    <Card>
      <CardHeader className="gap-2">
        <ClockIcon className="size-5 text-amber-600" />
        <CardTitle>{label.title}</CardTitle>
        <CardDescription>{label.description}</CardDescription>
      </CardHeader>
      <CardContent />
      <CardFooter>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRetract}
          disabled={isPending}
        >
          {isPending ? "Withdrawing…" : label.retractLabel}
        </Button>
      </CardFooter>
    </Card>
  );
}
