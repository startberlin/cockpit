"use client";

import { MoreHorizontal, UserCog } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { impersonateAction } from "./impersonate-action";

interface MemberHeaderMenuProps {
  userId: string;
  userEmail: string;
}

export function MemberHeaderMenu({ userId, userEmail }: MemberHeaderMenuProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setDialogOpen(true)}>
            <UserCog className="mr-2 h-4 w-4" />
            Impersonate
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
              onClick={() => setDialogOpen(false)}
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
