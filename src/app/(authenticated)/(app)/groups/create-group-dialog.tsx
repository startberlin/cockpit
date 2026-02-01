"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import { useQuery } from "@tanstack/react-query";
import { AlertCircleIcon, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller } from "react-hook-form";
import slugify from "slugify";
import { useDebounce } from "use-debounce";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { handleError } from "@/lib/utils";
import { checkSlugAction } from "./check-slug-action";
import { createGroupAction } from "./create-group-action";
import { createGroupSchema } from "./create-group-schema";

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateGroupDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateGroupDialogProps) {
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const { form, handleSubmitWithAction, action } = useHookFormAction(
    createGroupAction,
    zodResolver(createGroupSchema),
    {
      actionProps: {
        onSuccess: () => {
          onOpenChange(false);
          setSlugManuallyEdited(false);
          form.reset();
          onSuccess?.();
        },
        onError: handleError,
      },
      formProps: {
        defaultValues: {
          name: "",
          slug: "",
          integrations: {
            slack: false,
            email: false,
          },
        },
        mode: "onChange",
      },
    },
  );

  const nameValue = form.watch("name");
  const slugValue = form.watch("slug");
  const [debouncedSlug] = useDebounce(slugValue, 300);

  const isValidSlugFormat = Boolean(
    debouncedSlug && /^[a-z0-9-]+$/.test(debouncedSlug),
  );

  const slugQuery = useQuery({
    queryKey: ["slug-availability", debouncedSlug],
    queryFn: async () => {
      const result = await checkSlugAction({ slug: debouncedSlug });
      return result?.data?.available ?? false;
    },
    enabled: isValidSlugFormat,
  });

  // Auto-generate slug from name when name changes (if not manually edited)
  useEffect(() => {
    if (!slugManuallyEdited && nameValue) {
      const generatedSlug = slugify(nameValue, {
        lower: true,
        strict: true,
      });
      form.setValue("slug", generatedSlug, { shouldValidate: true });
    }
  }, [nameValue, slugManuallyEdited, form]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSlugManuallyEdited(false);
    }
  }, [open]);

  // Trigger parent validation when nested integration fields change
  // This is required because RHF + Zod only validates the specific field path,
  // not the parent's .refine() which checks cross-field constraints
  useEffect(() => {
    const subscription = form.watch((_, { name }) => {
      if (name?.startsWith("integrations.")) {
        form.trigger("integrations");
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlugManuallyEdited(true);
    form.setValue("slug", e.target.value, { shouldValidate: true });
  };

  // Derive availability state from query and input state
  const isTyping = slugValue !== debouncedSlug;
  const slugAvailability =
    !slugValue || !isValidSlugFormat
      ? null
      : isTyping || slugQuery.isFetching
        ? "checking"
        : slugQuery.data
          ? "available"
          : "unavailable";

  const isSlugValid =
    slugAvailability === "available" && !form.formState.errors.slug;
  const canSubmit = form.formState.isValid && isSlugValid && !action.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create group</DialogTitle>
          <DialogDescription>
            Create a new group. You can add members to the group after it's
            created.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-y-6"
          onSubmit={handleSubmitWithAction}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input
                id="name"
                placeholder="Engineering Team"
                aria-invalid={!!form.formState.errors.name}
                disabled={action.isPending}
                {...form.register("name")}
              />
              <FieldError errors={[form.formState.errors.name]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="slug">Slug</FieldLabel>
              <div className="relative">
                <Input
                  id="slug"
                  placeholder="engineering-team"
                  className="pr-10 font-mono"
                  aria-invalid={
                    !!form.formState.errors.slug ||
                    slugAvailability === "unavailable"
                  }
                  disabled={action.isPending}
                  value={slugValue}
                  onChange={handleSlugChange}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {slugAvailability === "checking" && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {slugAvailability === "available" && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                  {slugAvailability === "unavailable" && (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                </div>
              </div>
              <FieldDescription className="pt-0.5 text-xs">
                Auto-generated from name but can be customized.
              </FieldDescription>
              {slugAvailability === "unavailable" && (
                <p className="text-sm text-destructive">
                  This slug is already taken.
                </p>
              )}
              <FieldError errors={[form.formState.errors.slug]} />
            </Field>
          </FieldGroup>

          <div className="flex flex-col gap-4">
            <Controller
              control={form.control}
              name="integrations.slack"
              render={({ field, fieldState }) => (
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="integrations.slack"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={action.isPending}
                    aria-invalid={!!fieldState.error}
                  />
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="integrations.slack" className="font-medium">
                      Create a Slack channel
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Members will be added to a private Slack channel{" "}
                      <span className="font-mono">
                        #{slugValue || "group-name"}
                      </span>{" "}
                      .
                    </p>
                  </div>
                </div>
              )}
            />

            <Controller
              control={form.control}
              name="integrations.email"
              render={({ field, fieldState }) => (
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="integrations.email"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={action.isPending}
                    aria-invalid={!!fieldState.error}
                  />
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="integrations.email" className="font-medium">
                      Create an email address
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Emails to{" "}
                      <span className="font-mono">
                        {slugValue || "group-name"}@start-berlin.com
                      </span>{" "}
                      will be sent to all group members.
                    </p>
                  </div>
                </div>
              )}
            />

            {form.formState.errors.integrations && (
              <p className="text-sm text-destructive">
                {form.formState.errors.integrations.message}
              </p>
            )}
          </div>

          {form.formState.errors.root && (
            <Alert className="text-destructive text-sm" variant="destructive">
              <AlertCircleIcon className="h-4 w-4" />
              <AlertTitle>An error occurred</AlertTitle>
              <AlertDescription>
                <p>{form.formState.errors.root.message}</p>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={!canSubmit}>
              {action.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
