"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
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
        <Button variant="ghost" size="sm" className="-ml-2 mb-2" asChild>
          <Link href="/admin/tasks">
            <ArrowLeftIcon className="size-4" />
            Tasks
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          Cancellation Request
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {subjectUser.name} has submitted a cancellation request.
        </p>
      </div>

      <div className="grid grid-cols-2 overflow-hidden rounded-lg border">
        <div className="px-4 py-3 border-r">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Member
          </p>
          <p className="mt-0.5 text-sm font-medium">{subjectUser.name}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Submitted
          </p>
          <p className="mt-0.5 text-sm font-medium">
            {request.requestedAt.toLocaleDateString("en-GB", {
              dateStyle: "medium",
            })}
          </p>
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
