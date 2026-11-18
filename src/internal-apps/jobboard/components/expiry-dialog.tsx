"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import { CalendarClock } from "lucide-react";
import { type ReactNode, useState } from "react";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { editJobExpiryAction } from "../actions/mutations";
import { editJobExpirySchema } from "../actions/schemas";
import { FormError } from "./form-fields";

const DAY_MS = 86_400_000;

export function ExpiryDialog({
  id,
  expiresAt,
  publishedAt,
  disabled,
  onOpenChange,
  children,
}: {
  id: string;
  expiresAt: string | Date;
  publishedAt: string | Date;
  disabled?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const currentExpiry = new Date(expiresAt).toISOString();
  const values = {
    id,
    expiresAt: currentExpiry,
    expectedExpiresAt: currentExpiry,
    expectedPublishedAt: new Date(publishedAt).toISOString(),
  };
  const { form, action, handleSubmitWithAction } = useHookFormAction(
    editJobExpiryAction,
    zodResolver(editJobExpirySchema),
    {
      formProps: { defaultValues: values },
      actionProps: {
        onSuccess: () => {
          setOpen(false);
          onOpenChange?.(false);
          toast.success("Expiry updated.");
        },
        onError: ({ error }) =>
          toast.error(error.serverError ?? "Check the expiry date."),
      },
    },
  );
  const latestExpiry = new Date(Date.now() + 364 * DAY_MS)
    .toISOString()
    .slice(0, 10);
  const extend = (days: number) => {
    const date = new Date(new Date(currentExpiry).getTime() + days * DAY_MS)
      .toISOString()
      .slice(0, 10);
    form.setValue("expiresAt", `${date}T23:59:59.000Z`, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (action.isPending) return;
        if (next) {
          form.reset(values);
          action.reset();
        }
        setOpen(next);
        onOpenChange?.(next);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled}>
          <CalendarClock className="size-4" />
          {children ?? "Edit expiry"}
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={!action.isPending}>
        <DialogHeader>
          <DialogTitle>Edit expiry</DialogTitle>
          <DialogDescription>
            Changes only the expiry of the published listing.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            method="post"
            onSubmit={handleSubmitWithAction}
            className="space-y-5"
          >
            <fieldset disabled={action.isPending} className="space-y-2">
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
                        max={latestExpiry}
                        value={field.value.slice(0, 10)}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
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
              <div className="flex gap-2">
                {[30, 60].map((days) => (
                  <Button
                    key={days}
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={
                      new Date(
                        new Date(currentExpiry).getTime() + days * DAY_MS,
                      )
                        .toISOString()
                        .slice(0, 10) > latestExpiry
                    }
                    onClick={() => extend(days)}
                  >
                    +{days} days
                  </Button>
                ))}
              </div>
            </fieldset>
            <FormError message={action.result.serverError} />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={action.isPending}
                onClick={() => {
                  setOpen(false);
                  onOpenChange?.(false);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={action.isPending || !form.formState.isDirty}
              >
                {action.isPending ? "Saving" : "Save expiry"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
