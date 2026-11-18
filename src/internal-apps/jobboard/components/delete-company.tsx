"use client";

import { Loader2Icon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteCompanyAction } from "../actions/mutations";
import { FormError } from "./form-fields";

export function DeleteCompany({
  id,
  name,
  jobCount = 0,
}: {
  id: string;
  name: string;
  jobCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const action = useAction(deleteCompanyAction, {
    onSuccess: () => {
      setOpen(false);
      toast.success("Company deleted.");
      router.replace("/jobboard/companies");
    },
    onError: ({ error }) =>
      toast.error(error.serverError ?? "Unable to delete this company."),
  });
  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h2 className="text-sm font-semibold">Delete company</h2>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          {jobCount
            ? `This company has ${jobCount} linked ${jobCount === 1 ? "job" : "jobs"}. Keep the company record to preserve their history.`
            : "Permanently remove this company and its private contacts."}
        </p>
      </div>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!action.isPending) setOpen(value);
        }}
      >
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="min-h-11 shrink-0 text-destructive hover:bg-destructive/5 hover:text-destructive"
            disabled={jobCount > 0}
          >
            <Trash2Icon aria-hidden="true" /> Delete company
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="break-words">Delete {name}?</DialogTitle>
            <DialogDescription>
              This removes the company profile and its private contacts.
              Companies with any linked jobs cannot be deleted.
            </DialogDescription>
          </DialogHeader>
          <FormError message={action.result.serverError} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => setOpen(false)}
              disabled={action.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="min-h-11"
              disabled={action.isPending}
              onClick={() => action.execute({ id })}
            >
              {action.isPending ? (
                <Loader2Icon
                  className="animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : null}
              {action.isPending ? "Deleting" : "Delete company"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
