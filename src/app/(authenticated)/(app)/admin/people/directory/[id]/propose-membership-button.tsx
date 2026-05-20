"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { proposeMembershipAction } from "@/app/(authenticated)/(app)/people/propose-membership-action";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ProposeMembershipButtonProps {
  userId: string;
  firstName: string;
  lastName: string;
}

export function ProposeMembershipButton({
  userId,
  firstName,
  lastName,
}: ProposeMembershipButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const { execute, isPending } = useAction(proposeMembershipAction, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
      toast.success("Membership proposed", {
        description:
          "The board admission workflow has been started for this member.",
      });
    },
    onError: () => {
      toast.error(
        "Could not propose membership. Please try again. If this keeps happening, email operations@start-berlin.com.",
      );
    },
  });

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Propose for membership
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Propose {firstName} {lastName} for membership?
            </DialogTitle>
            <DialogDescription>
              This starts the board admission workflow for this member. The
              board will be asked to vote on their admission.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isPending}
              onClick={() => execute({ userId })}
            >
              {isPending ? "Proposing..." : "Propose for membership"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
