"use client";

import { CreateUserForm } from "@/components/create-user-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batches: { number: number }[];
  onSuccess?: () => void;
}

export function CreateUserDialog({
  open,
  onOpenChange,
  batches,
  onSuccess,
}: CreateUserDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add member</DialogTitle>
          <DialogDescription>
            Add a member and send their invitation to the personal email address
            below. START Cockpit will prepare their START Berlin account.
          </DialogDescription>
        </DialogHeader>
        <CreateUserForm
          batches={batches}
          onSuccess={() => {
            onOpenChange(false);
            onSuccess?.();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
