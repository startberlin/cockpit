"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
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
import { boardKickAction } from "./board-kick-action";

interface BoardKickButtonProps {
  userId: string;
  firstName: string;
  lastName: string;
}

export function BoardKickButton({
  userId,
  firstName,
  lastName,
}: BoardKickButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const { execute, isPending } = useAction(boardKickAction, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
      toast.success(`${firstName} ${lastName} has been removed.`, {
        description: "Their account access has been revoked immediately.",
      });
    },
    onError: () => {
      toast.error(
        "Could not remove member. Please try again or contact operations@start-berlin.com.",
      );
    },
  });

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        Remove member
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Remove {firstName} {lastName}?
            </DialogTitle>
            <DialogDescription>
              This immediately revokes their account access and starts the
              cancellation process. This action cannot be undone. The board will
              be notified.
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
              variant="destructive"
              disabled={isPending}
              onClick={() => execute({ targetUserId: userId })}
            >
              {isPending ? "Removing…" : "Remove member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
