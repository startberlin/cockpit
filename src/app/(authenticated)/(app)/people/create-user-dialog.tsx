"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import { AlertCircleIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import * as React from "react";
import { Controller } from "react-hook-form";
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
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Department } from "@/db/schema";
import { DEPARTMENTS } from "@/lib/enums";
import { generateCompanyEmail } from "@/lib/google-workspace/email";
import { handleError } from "@/lib/utils";
import { checkWorkspaceEmailAction } from "./check-workspace-email-action";
import { createUserAction } from "./create-user-action";
import { createUserSchema } from "./create-user-schema";

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
  const firstName = form.watch("firstName");
  const lastName = form.watch("lastName");
  const companyEmail = React.useMemo(() => {
    if (!firstName || !lastName) {
      return null;
    }

    return generateCompanyEmail(firstName, lastName);
  }, [firstName, lastName]);
  const emailCheck = useAction(checkWorkspaceEmailAction, {
    onError: handleError,
  });

  React.useEffect(() => {
    if (!companyEmail) {
      emailCheck.reset();
      return;
    }

    const timeout = window.setTimeout(() => {
      emailCheck.execute({ email: companyEmail });
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [companyEmail, emailCheck.execute, emailCheck.reset]);

  const emailConflict =
    !!companyEmail &&
    emailCheck.result.data?.email === companyEmail &&
    !emailCheck.result.data.available;
  const emailCheckUnavailable =
    !!companyEmail && !!emailCheck.result.serverError;
  const emailCheckPending = !!companyEmail && emailCheck.status === "executing";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
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
                      {...form.register("firstName")}
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
                      {...form.register("lastName")}
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
                  Use a personal email address they can keep long-term. START
                  Cockpit will send their invitation there.
                </FieldDescription>
                <FieldError errors={[form.formState.errors.personalEmail]} />
              </Field>
              {companyEmail && (
                <Field>
                  <FieldLabel>START email</FieldLabel>
                  <div className="rounded-md border px-3 py-2 text-sm">
                    {companyEmail}
                  </div>
                  <FieldDescription className="pt-0.5 text-xs">
                    {emailCheckPending
                      ? "Checking whether this START email is available..."
                      : emailConflict
                        ? "This START email already exists. Import the member from Google Workspace instead."
                        : emailCheckUnavailable
                          ? "Could not check this START email right now. Try again before adding the member."
                          : "This will become their START Berlin email address."}
                  </FieldDescription>
                </Field>
              )}
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
                name="department"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Department</FieldLabel>
                    <Select
                      value={field.value ?? ""}
                      onValueChange={(value) =>
                        field.onChange(value === "none" ? null : value)
                      }
                      disabled={action.isPending}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No department yet</SelectItem>
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

              <Controller
                name="status"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Status</FieldLabel>
                    <Select
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      disabled={action.isPending}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem key="onboarding" value="onboarding">
                          Onboarding
                        </SelectItem>
                        <SelectItem key="member" value="member">
                          Member
                        </SelectItem>
                        <SelectItem
                          key="supporting_alumni"
                          value="supporting_alumni"
                        >
                          Supporting alumni
                        </SelectItem>
                        <SelectItem key="alumni" value="alumni">
                          Alumni
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
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
