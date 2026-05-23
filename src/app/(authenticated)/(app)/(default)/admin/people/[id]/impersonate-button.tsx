"use client";

import { UserCog } from "lucide-react";
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
import { impersonateAction } from "./impersonate-action";

interface ImpersonateButtonProps {
  userId: string;
  userEmail: string;
}

export function ImpersonateButton({
  userId,
  userEmail,
}: ImpersonateButtonProps) {
  const [open, setOpen] = useState(false);

  const { execute, isPending } = useAction(impersonateAction, {
    onSuccess: () => {
      toast.success(`Now impersonating ${userEmail}`);
      window.location.href = "/membership";
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Failed to impersonate");
    },
  });

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <UserCog />
        Impersonate
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Impersonate {userEmail}?</DialogTitle>
            <DialogDescription>
              You will be signed in as this member and redirected to the
              membership page. Your own session will be suspended until you sign
              out of the impersonated account.
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
              {isPending ? "Starting…" : "Impersonate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
