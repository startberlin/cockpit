"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import { useQuery } from "@tanstack/react-query";
import { Check, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useDebounce } from "use-debounce";
import { Can } from "@/components/can";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { slugifyGroupName } from "@/lib/google-workspace/email";
import { checkEmailPrefixAction, checkSlugAction } from "./check-slug-action";
import { createGroupAction } from "./create-group-action";
import { createGroupSchema } from "./create-group-schema";

const VALID_SLUG = /^[a-z0-9-]+$/;
const VALID_PREFIX = /^[a-z0-9-]+$/;

function AvailabilityIcon({
  checking,
  available,
}: {
  checking: boolean;
  available: boolean | null;
}) {
  if (checking) return <Spinner className="size-3.5 text-muted-foreground" />;
  if (available === true) return <Check className="size-3.5 text-green-600" />;
  if (available === false) return <X className="size-3.5 text-destructive" />;
  return null;
}

export function CreateGroupDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  const { form, action, handleSubmitWithAction } = useHookFormAction(
    createGroupAction,
    zodResolver(createGroupSchema),
    {
      actionProps: {
        onSuccess: () => {
          toast.success("Group created.");
          setOpen(false);
          setSlugTouched(false);
          form.reset();
          router.refresh();
        },
        onError: ({ error }) => {
          toast.error(
            error.serverError ?? "Could not create group. Please try again.",
          );
        },
      },
      formProps: {
        defaultValues: {
          name: "",
          slug: "",
          integrations: { email: false, googleEmailPrefix: undefined },
        },
      },
    },
  );

  const watchedSlug = form.watch("slug");
  const watchedPrefix = form.watch("integrations.googleEmailPrefix");
  const emailEnabled = form.watch("integrations.email");

  const [debouncedSlug] = useDebounce(watchedSlug, 400);
  const [debouncedPrefix] = useDebounce(watchedPrefix, 400);

  const slugValid = VALID_SLUG.test(debouncedSlug ?? "");
  const prefixValid = VALID_PREFIX.test(debouncedPrefix ?? "");

  const slugQuery = useQuery({
    queryKey: ["slug-availability", debouncedSlug],
    queryFn: async () => {
      const result = await checkSlugAction({ slug: debouncedSlug ?? "" });
      return result?.data ?? null;
    },
    enabled: slugValid && (debouncedSlug ?? "").length > 0,
    staleTime: (query) =>
      query.state.data?.available === false ? Number.POSITIVE_INFINITY : 0,
  });

  const prefixQuery = useQuery({
    queryKey: ["email-prefix-availability", debouncedPrefix],
    queryFn: async () => {
      const result = await checkEmailPrefixAction({
        prefix: debouncedPrefix ?? "",
      });
      return result?.data ?? null;
    },
    enabled: emailEnabled && prefixValid && (debouncedPrefix ?? "").length > 0,
    staleTime: (query) =>
      query.state.data?.available === false ? Number.POSITIVE_INFINITY : 0,
  });

  const slugChecking =
    slugValid &&
    (watchedSlug ?? "").length > 0 &&
    (watchedSlug !== debouncedSlug || slugQuery.isFetching);

  const prefixChecking =
    !!emailEnabled &&
    prefixValid &&
    (watchedPrefix ?? "").length > 0 &&
    (watchedPrefix !== debouncedPrefix || prefixQuery.isFetching);

  const slugAvailable = slugChecking
    ? null
    : (slugQuery.data?.available ?? null);
  const prefixAvailable = prefixChecking
    ? null
    : (prefixQuery.data?.available ?? null);

  const canSubmit =
    !action.isPending &&
    slugAvailable !== false &&
    (!emailEnabled || prefixAvailable !== false);

  return (
    <Can permission="groups.create">
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) {
            form.reset();
            setSlugTouched(false);
          }
        }}
      >
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Create group
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create group</DialogTitle>
            <DialogDescription>
              Create a new manual group. Members are added one by one.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={handleSubmitWithAction} className="space-y-4">
              {/* Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <InputGroup>
                      <InputGroupInput
                        placeholder="Group name"
                        aria-invalid={fieldState.invalid}
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          if (!slugTouched) {
                            const generated = slugifyGroupName(e.target.value);
                            form.setValue("slug", generated, {
                              shouldValidate: true,
                            });
                            form.setValue(
                              "integrations.googleEmailPrefix",
                              generated,
                              { shouldValidate: true },
                            );
                          }
                        }}
                      />
                    </InputGroup>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Slug */}
              <FormField
                control={form.control}
                name="slug"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <InputGroup>
                      <InputGroupInput
                        placeholder="group-slug"
                        aria-invalid={
                          fieldState.invalid || slugAvailable === false
                        }
                        {...field}
                        onChange={(e) => {
                          setSlugTouched(true);
                          field.onChange(e);
                        }}
                      />
                      <InputGroupAddon align="inline-end">
                        <AvailabilityIcon
                          checking={slugChecking}
                          available={slugAvailable}
                        />
                      </InputGroupAddon>
                    </InputGroup>
                    <FormDescription>
                      {slugAvailable === false
                        ? slugQuery.data?.reason === "reserved"
                          ? "This slug is reserved for a system group."
                          : "This slug is already taken."
                        : "Lowercase letters, numbers, and hyphens."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Email toggle */}
              <FormField
                control={form.control}
                name="integrations.email"
                render={({ field }) => (
                  <FormItem className="flex items-start gap-3 space-y-0">
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                    <div>
                      <FormLabel>Create an email address</FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              {/* Email prefix */}
              {emailEnabled && (
                <FormField
                  control={form.control}
                  name="integrations.googleEmailPrefix"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>Email prefix</FormLabel>
                      <InputGroup>
                        <InputGroupInput
                          placeholder={watchedSlug || "my-group"}
                          aria-invalid={
                            fieldState.invalid || prefixAvailable === false
                          }
                          {...field}
                          value={field.value ?? ""}
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupText>@start-berlin.com</InputGroupText>
                          <AvailabilityIcon
                            checking={prefixChecking}
                            available={prefixAvailable}
                          />
                        </InputGroupAddon>
                      </InputGroup>
                      {prefixAvailable === false && (
                        <FormDescription className="text-destructive">
                          This email is already in use on Google.
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!canSubmit}>
                  {action.isPending ? "Creating…" : "Create group"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Can>
  );
}
