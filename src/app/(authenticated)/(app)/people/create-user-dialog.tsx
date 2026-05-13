"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import { useQuery } from "@tanstack/react-query";
import { AlertCircleIcon, CheckIcon, PencilIcon, XIcon } from "lucide-react";
import * as React from "react";
import { Controller } from "react-hook-form";
import { useDebounce } from "use-debounce";
import { BatchSelect } from "@/components/batch-select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Department } from "@/db/schema";
import { DEPARTMENTS } from "@/lib/enums";
import { generateCompanyEmail } from "@/lib/google-workspace/email";
import { handleError } from "@/lib/utils";
import { checkWorkspaceEmailAction } from "./check-workspace-email-action";
import { createUserAction } from "./create-user-action";
import { companyEmailSchema, createUserSchema } from "./create-user-schema";

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
  const resolver = React.useMemo(() => zodResolver(createUserSchema), []);
  const defaultValues = React.useMemo(
    () => ({
      firstName: "",
      lastName: "",
      personalEmail: "",
      companyEmail: "",
      batchNumber: undefined,
      department: null as Department | null,
      status: "onboarding" as const,
    }),
    [],
  );
  const { form, handleSubmitWithAction, action } = useHookFormAction(
    createUserAction,
    resolver,
    {
      actionProps: {
        onSuccess: () => {
          onOpenChange(false);
          onSuccess?.();
        },
        onError: handleError,
      },
      formProps: {
        defaultValues,
        mode: "onChange",
      },
    },
  );

  const [emailUnlocked, setEmailUnlocked] = React.useState(false);

  const watchedCompanyEmail = form.watch("companyEmail");
  const status = form.watch("status");
  const { setValue, getValues, trigger } = form;

  const [debouncedEmail] = useDebounce(watchedCompanyEmail, 300);

  const isValidDebouncedEmail = companyEmailSchema.safeParse(debouncedEmail).success;
  const isValidCurrentEmail = companyEmailSchema.safeParse(watchedCompanyEmail).success;

  const emailQuery = useQuery({
    queryKey: ["email-availability", debouncedEmail],
    queryFn: async () => {
      const result = await checkWorkspaceEmailAction({ email: debouncedEmail });
      return result?.data ?? null;
    },
    enabled: isValidDebouncedEmail,
    // Cache taken emails forever (a taken email won't become free); always re-check available ones.
    staleTime: (query) => (query.state.data?.available === false ? Infinity : 0),
  });

  const emailCheckPending = isValidCurrentEmail && (watchedCompanyEmail !== debouncedEmail || emailQuery.isFetching);
  const emailConflict = !emailCheckPending && emailQuery.data?.available === false;
  const emailAvailable = !emailCheckPending && emailQuery.data?.available === true;
  const emailCheckUnavailable = !emailCheckPending && emailQuery.isError;

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
        <form
          className="flex flex-col gap-y-6"
          onSubmit={handleSubmitWithAction}
        >
          <FieldSet>
            <FieldLegend>Basic information</FieldLegend>
            <FieldGroup>
              <div className="flex gap-4">
                <Field className="flex-1">
                  <FieldLabel htmlFor="firstName">First Name</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="firstName"
                      placeholder="First name"
                      aria-invalid={!!form.formState.errors.firstName}
                      disabled={action.isPending}
                      {...form.register("firstName", {
                        onChange: (e) => {
                          if (emailUnlocked) return;
                          const last = getValues("lastName");
                          const generated =
                            e.target.value && last
                              ? generateCompanyEmail(e.target.value, last)
                              : "";
                          setValue("companyEmail", generated, {
                            shouldValidate: !!generated,
                          });
                        },
                      })}
                    />
                  </InputGroup>
                  <FieldError errors={[form.formState.errors.firstName]} />
                </Field>
                <Field className="flex-1">
                  <FieldLabel htmlFor="lastName">Last Name</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="lastName"
                      placeholder="Last name"
                      aria-invalid={!!form.formState.errors.lastName}
                      disabled={action.isPending}
                      {...form.register("lastName", {
                        onChange: (e) => {
                          if (emailUnlocked) return;
                          const first = getValues("firstName");
                          const generated =
                            first && e.target.value
                              ? generateCompanyEmail(first, e.target.value)
                              : "";
                          setValue("companyEmail", generated, {
                            shouldValidate: !!generated,
                          });
                        },
                      })}
                    />
                  </InputGroup>
                  <FieldError errors={[form.formState.errors.lastName]} />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="personalEmail">
                  Personal email address
                </FieldLabel>
                <Input
                  id="personalEmail"
                  type="email"
                  placeholder="you@email.com"
                  aria-invalid={!!form.formState.errors.personalEmail}
                  disabled={action.isPending}
                  {...form.register("personalEmail")}
                />
                <FieldDescription className="pt-0.5 text-xs">
                  Use a personal email they already have access to. START
                  Cockpit will send their invitation there.
                </FieldDescription>
                <FieldError errors={[form.formState.errors.personalEmail]} />
              </Field>
              <Controller
                name="companyEmail"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor="companyEmail">START email</FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id="companyEmail"
                        disabled={!emailUnlocked || action.isPending}
                        aria-invalid={
                          !!fieldState.error ||
                          emailConflict ||
                          emailCheckUnavailable
                        }
                        {...field}
                      />
                      <InputGroupAddon align="inline-end">
                        {emailCheckPending ? (
                          <Spinner className="text-muted-foreground" />
                        ) : emailConflict ? (
                          <XIcon className="size-4 text-destructive" />
                        ) : emailAvailable ? (
                          <CheckIcon className="size-4 text-green-600" />
                        ) : null}
                        {!emailUnlocked && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <InputGroupButton
                                className="rounded-full"
                                size="icon-xs"
                                type="button"
                                aria-label="Edit START email"
                                onClick={() => setEmailUnlocked(true)}
                              >
                                <PencilIcon />
                              </InputGroupButton>
                            </TooltipTrigger>
                            <TooltipContent>
                              Edit START email address
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </InputGroupAddon>
                    </InputGroup>
                    {emailUnlocked && <FieldError errors={[fieldState.error]} />}
                    {(!emailUnlocked || !fieldState.error) && (
                      <FieldDescription className="pt-0.5 text-xs">
                        {emailConflict ? (
                          <span className="text-destructive">Not available</span>
                        ) : (
                          "This will become their START Berlin email address."
                        )}
                      </FieldDescription>
                    )}
                  </Field>
                )}
              />
            </FieldGroup>
          </FieldSet>

          <FieldSet>
            <FieldLegend>Organization</FieldLegend>
            <FieldGroup>
              <Controller
                name="batchNumber"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Batch</FieldLabel>
                    <BatchSelect
                      batches={batches}
                      value={field.value}
                      onChange={field.onChange}
                      disabled={action.isPending}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />

              <Controller
                name="status"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Status</FieldLabel>
                    <Select
                      value={field.value ?? ""}
                      onValueChange={(value) => {
                        field.onChange(value);
                        if (
                          value === "alumni" ||
                          value === "supporting_alumni"
                        ) {
                          setValue("department", null);
                        }
                        trigger("department");
                      }}
                      disabled={action.isPending}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="onboarding">Onboarding</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="supporting_alumni">
                          Supporting alumni
                        </SelectItem>
                        <SelectItem value="alumni">Alumni</SelectItem>
                      </SelectContent>
                    </Select>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />

              {(status === "member" || status === "onboarding") && (
                <Controller
                  name="department"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel>Department</FieldLabel>
                      <Select
                        value={field.value ?? ""}
                        onValueChange={(value) => field.onChange(value)}
                        disabled={action.isPending}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a department" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(DEPARTMENTS).map(([id, name]) => (
                            <SelectItem key={id} value={id}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
              )}
            </FieldGroup>
          </FieldSet>

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
            <Button
              type="submit"
              disabled={
                !form.formState.isValid ||
                action.isPending ||
                emailCheckPending ||
                emailConflict ||
                emailCheckUnavailable
              }
            >
              Add member
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
