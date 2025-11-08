"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import { AlertCircleIcon, InfoIcon } from "lucide-react";
import { Controller } from "react-hook-form";
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
import { handleError } from "@/lib/utils";
import { createUserAction } from "./create-user-action";
import { createUserSchema } from "./create-user-schema";

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batches: { number: number }[];
  departments: { id: string; name: string }[];
  onSuccess?: () => void;
}

export function CreateUserDialog({
  open,
  onOpenChange,
  batches,
  departments,
  onSuccess,
}: CreateUserDialogProps) {
  const { form, handleSubmitWithAction, action } = useHookFormAction(
    createUserAction,
    zodResolver(createUserSchema),
    {
      actionProps: {
        onSuccess: () => {
          onOpenChange(false);
          onSuccess?.();
        },
        onError: handleError,
      },
      formProps: {
        defaultValues: {
          firstName: "",
          lastName: "",
          personalEmail: "",
          batchNumber: batches[0]?.number ?? 0,
          departmentId: departments[0]?.id ?? "",
          status: "onboarding",
        },
        mode: "onChange",
      },
    },
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>
            Invite a new user to START Cockpit. This will create a new Google
            account and send an invite to the user's personal email address.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-y-6"
          onSubmit={handleSubmitWithAction}
        >
          <FieldSet>
            <FieldLegend>Basic Information</FieldLegend>
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
                <FieldLabel htmlFor="personalEmail">Email address</FieldLabel>
                <Input
                  id="personalEmail"
                  type="email"
                  placeholder="you@email.com"
                  aria-invalid={!!form.formState.errors.personalEmail}
                  disabled={action.isPending}
                  {...form.register("personalEmail")}
                />
                <FieldDescription className="pt-0.5 text-xs">
                  START Cockpit will send an invite to this email address.
                </FieldDescription>
                <FieldError errors={[form.formState.errors.personalEmail]} />
              </Field>
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
                    <Select
                      value={String(field.value ?? "")}
                      onValueChange={(v) => field.onChange(Number(v))}
                      disabled={action.isPending}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a batch" />
                      </SelectTrigger>
                      <SelectContent>
                        {batches.map((b) => (
                          <SelectItem key={b.number} value={String(b.number)}>
                            Batch {b.number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />

              <Controller
                name="departmentId"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Department</FieldLabel>
                    <Select
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      disabled={action.isPending}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
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
                          Supporting Alumni
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
              <AlertTitle>An error occured</AlertTitle>
              <AlertDescription>
                <p>{form.formState.errors.root.message}</p>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="submit"
              disabled={!form.formState.isValid || action.isPending}
            >
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
