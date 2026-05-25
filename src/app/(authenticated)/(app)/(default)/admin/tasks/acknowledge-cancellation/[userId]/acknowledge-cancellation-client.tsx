"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { MembershipTransitionRequest } from "@/db/schema/membership-transition-request";
import { acknowledgeCancellationAction } from "./acknowledge-cancellation-action";

interface SubjectUser {
  id: string;
  name: string;
}

interface AcknowledgeCancellationClientProps {
  request: MembershipTransitionRequest;
  subjectUser: SubjectUser;
  canAct: boolean;
}

export default function AcknowledgeCancellationClient({
  request,
  subjectUser,
  canAct,
}: AcknowledgeCancellationClientProps) {
  const router = useRouter();

  const { execute, isPending } = useAction(acknowledgeCancellationAction, {
    onSuccess: () => {
      toast.success("Cancellation acknowledged.");
      router.push("/admin/tasks");
    },
    onError: ({ error }) => {
      toast.error(
        error.serverError ?? "Failed to acknowledge. Please try again.",
      );
    },
  });

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Cancellation Request
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {subjectUser.name} has submitted a cancellation request.
        </p>
      </div>

      <div className="rounded-lg border p-4 space-y-2 text-sm">
        <div className="flex gap-2">
          <span className="text-muted-foreground w-24 shrink-0">Member</span>
          <span className="font-medium">{subjectUser.name}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-muted-foreground w-24 shrink-0">Submitted</span>
          <span>
            {request.requestedAt.toLocaleDateString("en-GB", {
              dateStyle: "medium",
            })}
          </span>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        The cancellation will proceed automatically after 7 days. Acknowledging
        confirms you are aware of this member&apos;s departure.
      </p>

      {!canAct && (
        <p className="text-sm text-muted-foreground">
          You have view-only access to this request.
        </p>
      )}

      {canAct && (
        <div>
          <Button
            disabled={isPending}
            onClick={() => execute({ transitionRequestId: request.id })}
          >
            {isPending ? "Acknowledging…" : "Acknowledge"}
          </Button>
        </div>
      )}
    </div>
  );
}
