"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircleIcon,
  CheckCircle2,
  Loader2,
  PencilIcon,
  XCircle,
} from "lucide-react";
import { parseAsBoolean, useQueryState } from "nuqs";
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { handleError } from "@/lib/utils";
import {
  checkGoogleEmailPrefixAction,
  checkSlackSlugAction,
} from "./check-integration-actions";
import { checkSlugAction } from "./check-slug-action";
import { createGroupAction } from "./create-group-action";
import { createGroupSchema } from "./create-group-schema";

interface CreateGroupDialogProps {
  onSuccess?: () => void;
}

type AvailabilityState = "checking" | "available" | "unavailable" | null;

function AvailabilityIcon({ state }: { state: AvailabilityState }) {
  if (state === "checking")
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (state === "available")
    return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (state === "unavailable")
    return <XCircle className="h-4 w-4 text-destructive" />;
  return null;
}

function useAvailabilityQuery(
  value: string,
  enabled: boolean,
  queryFn: (value: string) => Promise<boolean>,
): AvailabilityState {
  const [debounced] = useDebounce(value, 300);
  const isTyping = value !== debounced;
  const isValidFormat = Boolean(debounced && /^[a-z0-9-]+$/.test(debounced));

  const query = useQuery({
    queryKey: ["availability", queryFn.name, debounced],
    queryFn: () => queryFn(debounced),
    enabled: enabled && isValidFormat,
  });

  if (!value || !isValidFormat) return null;
  if (isTyping || query.isFetching) return "checking";
  if (query.data) return "available";
  return "unavailable";
}

export function CreateGroupDialog({ onSuccess }: CreateGroupDialogProps) {
  const [open, setOpen] = useQueryState(
    "create",
    parseAsBoolean.withDefault(false),
  );
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [slackSlugUnlocked, setSlackSlugUnlocked] = useState(false);
  const [googlePrefixUnlocked, setGooglePrefixUnlocked] = useState(false);

  const { form, handleSubmitWithAction, action } = useHookFormAction(
    createGroupAction,
    zodResolver(createGroupSchema),
    {
      actionProps: {
        onSuccess: () => {
          setOpen(false);
          setSlugManuallyEdited(false);
          setSlackSlugUnlocked(false);
          setGooglePrefixUnlocked(false);
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
            slackChannelSlug: undefined,
            email: false,
            googleEmailPrefix: undefined,
          },
        },
        mode: "onChange",
      },
    },
  );

  const nameValue = form.watch("name");
  const slugValue = form.watch("slug");
  const slackEnabled = form.watch("integrations.slack");
  const emailEnabled = form.watch("integrations.email");
  const slackChannelSlugValue =
    form.watch("integrations.slackChannelSlug") ?? slugValue;
  const googleEmailPrefixValue =
    form.watch("integrations.googleEmailPrefix") ?? slugValue;

  // Auto-generate slug from name
  useEffect(() => {
    if (!slugManuallyEdited && nameValue) {
      const generated = slugify(nameValue, { lower: true, strict: true });
      form.setValue("slug", generated, { shouldValidate: true });
    }
  }, [nameValue, slugManuallyEdited, form]);

  // Reset lock state when dialog closes
  useEffect(() => {
    if (!open) {
      setSlugManuallyEdited(false);
      setSlackSlugUnlocked(false);
      setGooglePrefixUnlocked(false);
    }
  }, [open]);

  // Trigger parent validation when nested integration fields change
  useEffect(() => {
    const subscription = form.watch((_, { name }) => {
      if (name?.startsWith("integrations.")) {
        form.trigger("integrations");
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Slug availability
  const [debouncedSlug] = useDebounce(slugValue, 300);
  const isSlugTyping = slugValue !== debouncedSlug;
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
  const slugAvailability: AvailabilityState =
    !slugValue || !isValidSlugFormat
      ? null
      : isSlugTyping || slugQuery.isFetching
        ? "checking"
        : slugQuery.data
          ? "available"
          : "unavailable";

  // Slack channel slug availability
  const [debouncedSlackSlug] = useDebounce(slackChannelSlugValue, 300);
  const isSlackTyping = slackChannelSlugValue !== debouncedSlackSlug;
  const isValidSlackFormat = Boolean(
    debouncedSlackSlug && /^[a-z0-9-]+$/.test(debouncedSlackSlug),
  );
  const slackQuery = useQuery({
    queryKey: ["slack-availability", debouncedSlackSlug],
    queryFn: async () => {
      const result = await checkSlackSlugAction({ slug: debouncedSlackSlug });
      return result?.data?.available ?? false;
    },
    enabled: slackEnabled && isValidSlackFormat,
  });
  const slackAvailability: AvailabilityState =
    !slackEnabled || !slackChannelSlugValue || !isValidSlackFormat
      ? null
      : isSlackTyping || slackQuery.isFetching
        ? "checking"
        : slackQuery.data
          ? "available"
          : "unavailable";

  // Google email prefix availability
  const [debouncedGooglePrefix] = useDebounce(googleEmailPrefixValue, 300);
  const isGoogleTyping = googleEmailPrefixValue !== debouncedGooglePrefix;
  const isValidGoogleFormat = Boolean(
    debouncedGooglePrefix && /^[a-z0-9-]+$/.test(debouncedGooglePrefix),
  );
  const googleQuery = useQuery({
    queryKey: ["google-email-availability", debouncedGooglePrefix],
    queryFn: async () => {
      const result = await checkGoogleEmailPrefixAction({
        prefix: debouncedGooglePrefix,
      });
      return result?.data?.available ?? false;
    },
    enabled: emailEnabled && isValidGoogleFormat,
  });
  const googleAvailability: AvailabilityState =
    !emailEnabled || !googleEmailPrefixValue || !isValidGoogleFormat
      ? null
      : isGoogleTyping || googleQuery.isFetching
        ? "checking"
        : googleQuery.data
          ? "available"
          : "unavailable";

  const isSlugValid =
    slugAvailability === "available" && !form.formState.errors.slug;
  const isSlackValid =
    !slackEnabled ||
    slackAvailability === "available" ||
    slackAvailability === null;
  const isGoogleValid =
    !emailEnabled ||
    googleAvailability === "available" ||
    googleAvailability === null;
  const canSubmit =
    form.formState.isValid &&
    isSlugValid &&
    isSlackValid &&
    isGoogleValid &&
    !action.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
                  onChange={(e) => {
                    setSlugManuallyEdited(true);
                    form.setValue("slug", e.target.value, {
                      shouldValidate: true,
                    });
                  }}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <AvailabilityIcon state={slugAvailability} />
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
              render={({ field }) => (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="integrations.slack"
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        if (!checked) setSlackSlugUnlocked(false);
                      }}
                      disabled={action.isPending}
                    />
                    <Label htmlFor="integrations.slack" className="font-medium">
                      Create a Slack channel
                    </Label>
                  </div>
                  {field.value && (
                    <div className="ml-7">
                      <InputGroup
                        aria-invalid={slackAvailability === "unavailable"}
                      >
                        <InputGroupAddon align="inline-start">
                          <InputGroupText>#</InputGroupText>
                        </InputGroupAddon>
                        <InputGroupInput
                          className="font-mono"
                          disabled={!slackSlugUnlocked || action.isPending}
                          value={slackChannelSlugValue}
                          onChange={(e) => {
                            form.setValue(
                              "integrations.slackChannelSlug",
                              e.target.value,
                              { shouldValidate: true },
                            );
                          }}
                        />
                        <InputGroupAddon align="inline-end">
                          {!slackSlugUnlocked ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <InputGroupButton
                                  size="icon-xs"
                                  aria-label="Edit Slack channel name"
                                  onClick={() => setSlackSlugUnlocked(true)}
                                >
                                  <PencilIcon />
                                </InputGroupButton>
                              </TooltipTrigger>
                              <TooltipContent>
                                Edit Slack channel name
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <AvailabilityIcon state={slackAvailability} />
                          )}
                        </InputGroupAddon>
                      </InputGroup>
                      {slackAvailability === "unavailable" && (
                        <p className="mt-1 text-sm text-destructive">
                          This channel name is already in use.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            />

            <Controller
              control={form.control}
              name="integrations.email"
              render={({ field }) => (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="integrations.email"
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        if (!checked) setGooglePrefixUnlocked(false);
                      }}
                      disabled={action.isPending}
                    />
                    <Label htmlFor="integrations.email" className="font-medium">
                      Create an email address
                    </Label>
                  </div>
                  {field.value && (
                    <div className="ml-7">
                      <InputGroup
                        aria-invalid={googleAvailability === "unavailable"}
                      >
                        <InputGroupInput
                          className="font-mono"
                          disabled={!googlePrefixUnlocked || action.isPending}
                          value={googleEmailPrefixValue}
                          onChange={(e) => {
                            form.setValue(
                              "integrations.googleEmailPrefix",
                              e.target.value,
                              { shouldValidate: true },
                            );
                          }}
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupText>@start-berlin.com</InputGroupText>
                          {!googlePrefixUnlocked ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <InputGroupButton
                                  size="icon-xs"
                                  aria-label="Edit email address"
                                  onClick={() => setGooglePrefixUnlocked(true)}
                                >
                                  <PencilIcon />
                                </InputGroupButton>
                              </TooltipTrigger>
                              <TooltipContent>
                                Edit email address
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <AvailabilityIcon state={googleAvailability} />
                          )}
                        </InputGroupAddon>
                      </InputGroup>
                      {googleAvailability === "unavailable" && (
                        <p className="mt-1 text-sm text-destructive">
                          This email address is already in use.
                        </p>
                      )}
                    </div>
                  )}
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
