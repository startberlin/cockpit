"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { publishJobAction } from "../actions/mutations";
import { publishJobSchema } from "../actions/schemas";
import { FormError, TextField } from "./form-fields";

export function PublishDialog({
  id,
  reviewToken,
  expiresAt,
  disabled,
  published,
  onOpenChange,
}: {
  id: string;
  reviewToken: string;
  expiresAt?: string | Date | null;
  disabled: boolean;
  published: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const expiry =
    expiresAt && new Date(expiresAt) > new Date()
      ? new Date(expiresAt)
      : new Date(Date.now() + 60 * 86400000);
  const { form, action, handleSubmitWithAction } = useHookFormAction(
    publishJobAction,
    zodResolver(publishJobSchema),
    {
      formProps: {
        defaultValues: {
          id,
          reviewToken,
          expiresAt: `${expiry.toISOString().slice(0, 10)}T23:59:59.000Z`,
          reviewNotes: "",
        },
      },
      actionProps: {
        onSuccess: () => {
          setOpen(false);
          onOpenChange?.(false);
          toast.success("Listing published.");
        },
        onError: ({ error }) =>
          toast.error(
            error.serverError ?? "Check the review fields before publishing.",
          ),
      },
    },
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (action.isPending) return;
        setOpen(next);
        onOpenChange?.(next);
        if (next) {
          form.reset({
            id,
            reviewToken,
            expiresAt: `${expiry.toISOString().slice(0, 10)}T23:59:59.000Z`,
            reviewNotes: "",
          });
          action.reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" disabled={disabled}>
          {published ? "Review changes" : "Review and publish"}
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto"
        showCloseButton={!action.isPending}
      >
        <DialogHeader>
          <DialogTitle>Review and publish</DialogTitle>
          <DialogDescription>Publish the saved draft.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            method="post"
            onSubmit={handleSubmitWithAction}
            className="space-y-5"
          >
            <fieldset disabled={action.isPending} className="space-y-5">
              <FormField
                control={form.control}
                name="expiresAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry date (end of day, UTC)</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        min={new Date().toISOString().slice(0, 10)}
                        max={new Date(Date.now() + 364 * 86400000)
                          .toISOString()
                          .slice(0, 10)}
                        name={field.name}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        value={field.value?.slice(0, 10) ?? ""}
                        onChange={(event) =>
                          field.onChange(
                            event.target.value
                              ? `${event.target.value}T23:59:59.000Z`
                              : "",
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <TextField
                name="reviewNotes"
                label="Review notes"
                multiline
                required
                maxLength={5000}
              />
              <details className="text-sm text-muted-foreground">
                <summary className="w-fit cursor-pointer rounded-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  Review checklist
                </summary>
                <p className="mt-2 leading-relaxed">
                  Check the employer, application link, compensation and
                  non-discriminatory wording. For unpaid roles, record the
                  applicable exception and supporting reference. For work
                  abroad, record the countries and local requirements checked.
                </p>
              </details>
              <FormField
                control={form.control}
                name="reviewed"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-start gap-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value === true}
                          onCheckedChange={(checked) =>
                            field.onChange(checked === true ? true : undefined)
                          }
                        />
                      </FormControl>
                      <FormLabel className="text-sm leading-relaxed">
                        I reviewed this listing and approve publication.
                      </FormLabel>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormError message={action.result.serverError} />
            </fieldset>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  onOpenChange?.(false);
                }}
                disabled={action.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={action.isPending}>
                {action.isPending ? "Publishing" : "Publish listing"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
