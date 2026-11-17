"use client";

import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ParticipationControls } from "@/db/participation";
import { changeParticipationAction } from "./participation-action";

export function ParticipationDialog({
  member,
  open,
  onOpenChange,
  onSaved,
}: {
  member: ParticipationControls;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const { execute, isPending } = useAction(changeParticipationAction, {
    onSuccess: ({ data }) => {
      onOpenChange(false);
      if (data.outcome === "conflict") {
        toast.error(
          "The member's status changed. Check the profile and try again.",
        );
        return;
      }

      const message = data.paused
        ? "Participation paused"
        : "Participation resumed";
      if (data.notificationQueued) toast.success(message);
      else
        toast.warning(message, {
          description: "The notification could not be queued.",
        });
      onSaved?.();
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Could not update participation.");
    },
  });

  const actionLabel = member.pausedAt
    ? "Resume participation"
    : "Pause participation";
  const recipients = [
    member.notifyMember ? "the member" : null,
    member.departmentLeadCount > 0
      ? `${member.departmentLeadCount} department ${member.departmentLeadCount === 1 ? "lead" : "leads"}`
      : null,
  ].filter(Boolean);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !isPending && onOpenChange(next)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {actionLabel} for {member.memberName}?
          </DialogTitle>
          <DialogDescription>
            {member.pausedAt
              ? "The org chart and people directory will show that the member has resumed participation."
              : "The org chart and people directory will reflect the pause. Membership dues and access to START email and Cockpit continue as usual."}
          </DialogDescription>
        </DialogHeader>
        {recipients.length > 0 && (
          <p className="text-sm">
            Cockpit will email {recipients.join(" and ")}.
          </p>
        )}
        {member.hasPendingTransition && (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            A membership transition is in progress and will continue.
          </p>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isPending}
            onClick={() =>
              execute({
                userId: member.userId,
                expectedPausedAt: member.pausedAt,
              })
            }
          >
            {isPending ? "Saving" : actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
