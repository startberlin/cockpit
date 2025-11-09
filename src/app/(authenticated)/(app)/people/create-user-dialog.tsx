"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import { AlertCircleIcon, XIcon } from "lucide-react";
import { Controller, useFieldArray } from "react-hook-form";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
          users: [
            {
              firstName: "",
              lastName: "",
              personalEmail: "",
              batchNumber: batches[0]?.number ?? 0,
              departmentId: departments[0]?.id ?? "",
              status: "onboarding" as const,
            },
          ],
        },
        mode: "onChange",
      },
    },
  );

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "users",
  });
  const usersWatch = form.watch("users");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create user(s)</DialogTitle>
          <DialogDescription>
            Invite a new user to START Cockpit. This will create a new Google
            account and send an invite to the user's personal email address.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-y-6"
          onSubmit={handleSubmitWithAction}
        >
          <Accordion type="multiple" className="rounded-md border">
            {fields.map((f, index) => {
              const firstNameError =
                form.formState.errors.users?.[index]?.firstName;
              const lastNameError =
                form.formState.errors.users?.[index]?.lastName;
              const emailError =
                form.formState.errors.users?.[index]?.personalEmail;

              return (
                <AccordionItem key={f.id} value={f.id}>
                  <AccordionTrigger>
                    {`User ${index + 1}: ${
                      usersWatch?.[index]?.firstName ?? ""
                    } ${usersWatch?.[index]?.lastName ?? ""}`.trim() ||
                      `User ${index + 1}`}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="flex justify-end">
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                          aria-label={`Remove user ${index + 1}`}
                          className="text-destructive"
                        >
                          <XIcon className="mr-1 h-4 w-4" />
                          Remove
                        </Button>
                      )}
                    </div>
                    <FieldSet>
                      <FieldLegend>Basic Information</FieldLegend>
                      <FieldGroup>
                        <div className="flex gap-4">
                          <Field className="flex-1">
                            <FieldLabel htmlFor={`users.${index}.firstName`}>
                              First Name
                            </FieldLabel>
                            <InputGroup>
                              <InputGroupInput
                                id={`users.${index}.firstName`}
                                placeholder="First name"
                                aria-invalid={!!firstNameError}
                                disabled={action.isPending}
                                {...form.register(`users.${index}.firstName`)}
                              />
                            </InputGroup>
                            <FieldError errors={[firstNameError]} />
                          </Field>
                          <Field className="flex-1">
                            <FieldLabel htmlFor={`users.${index}.lastName`}>
                              Last Name
                            </FieldLabel>
                            <InputGroup>
                              <InputGroupInput
                                id={`users.${index}.lastName`}
                                placeholder="Last name"
                                aria-invalid={!!lastNameError}
                                disabled={action.isPending}
                                {...form.register(`users.${index}.lastName`)}
                              />
                            </InputGroup>
                            <FieldError errors={[lastNameError]} />
                          </Field>
                        </div>
                        <Field>
                          <FieldLabel htmlFor={`users.${index}.personalEmail`}>
                            Email address
                          </FieldLabel>
                          <InputGroup>
                            <InputGroupInput
                              id={`users.${index}.personalEmail`}
                              type="email"
                              placeholder="you@email.com"
                              aria-invalid={!!emailError}
                              disabled={action.isPending}
                              {...form.register(`users.${index}.personalEmail`)}
                            />
                            {fields.length > 1 && (
                              <InputGroupAddon align="inline-end">
                                <InputGroupButton
                                  type="button"
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={() => remove(index)}
                                  aria-label={`Remove user ${index + 1}`}
                                >
                                  <XIcon />
                                </InputGroupButton>
                              </InputGroupAddon>
                            )}
                          </InputGroup>
                          <FieldDescription className="pt-0.5 text-xs">
                            START Cockpit will send an invite to this email
                            address.
                          </FieldDescription>
                          <FieldError errors={[emailError]} />
                        </Field>
                      </FieldGroup>
                    </FieldSet>

                    <FieldSet>
                      <FieldLegend>Organization</FieldLegend>
                      <FieldGroup>
                        <Controller
                          name={`users.${index}.batchNumber`}
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
                                    <SelectItem
                                      key={b.number}
                                      value={String(b.number)}
                                    >
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
                          name={`users.${index}.departmentId`}
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
                          name={`users.${index}.status`}
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
                                  <SelectItem
                                    key="onboarding"
                                    value="onboarding"
                                  >
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
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>

          <div className="flex">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                append({
                  firstName: "",
                  lastName: "",
                  personalEmail: "",
                  batchNumber: batches[0]?.number ?? 0,
                  departmentId: departments[0]?.id ?? "",
                  status: "onboarding",
                })
              }
              disabled={action.isPending}
            >
              Add user
            </Button>
          </div>

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
              {`Create ${fields.length} user(s)`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
