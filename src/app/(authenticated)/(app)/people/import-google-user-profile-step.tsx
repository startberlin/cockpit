"use client";

import { AlertCircleIcon, LockIcon, PencilIcon } from "lucide-react";
import * as React from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { BatchSelect } from "@/components/batch-select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DEPARTMENTS } from "@/lib/enums";
import { USER_STATUS_INFO } from "@/lib/user-status";
import {
  type ImportGoogleWorkspaceUserData,
  importableUserStatus,
} from "./import-google-user-schema";
import type { WorkspaceCandidate } from "./import-google-user-types";

export interface ProfileStepProps {
  selected: WorkspaceCandidate | null;
  firstNameUnlocked: boolean;
  lastNameUnlocked: boolean;
  onUnlockFirstName: () => void;
  onUnlockLastName: () => void;
  batches: { number: number }[];
  onComplete: () => void;
  onBack: () => void;
  submitLabel: string;
  isSubmitDisabled: boolean;
  isPending: boolean;
  rootError?: string;
}

export function ProfileStep({
  selected,
  firstNameUnlocked,
  lastNameUnlocked,
  onUnlockFirstName,
  onUnlockLastName,
  batches,
  onComplete,
  onBack,
  submitLabel,
  isSubmitDisabled,
  isPending,
  rootError,
}: ProfileStepProps) {
  const {
    register,
    control,
    setValue,
    getValues,
    formState: { errors },
  } = useFormContext<ImportGoogleWorkspaceUserData>();

  const selectedStatus = useWatch({ control, name: "status" });
  const shouldShowDepartment = selectedStatus === "member";

  React.useEffect(() => {
    if (!shouldShowDepartment && getValues("department") !== null) {
      setValue("department", null);
    }
  }, [shouldShowDepartment, setValue, getValues]);

  return (
    <form
      className="flex flex-col gap-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        onComplete();
      }}
    >
      <FieldSet>
        <FieldLegend>START Cockpit profile</FieldLegend>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field className="min-w-0">
              <FieldLabel htmlFor="importFirstName">First name</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="importFirstName"
                  disabled={!firstNameUnlocked}
                  aria-invalid={!!errors.firstName}
                  {...register("firstName")}
                />
                {!firstNameUnlocked && (
                  <InputGroupAddon align="inline-end">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <InputGroupButton
                          className="rounded-full"
                          size="icon-xs"
                          aria-label="Edit first name"
                          onClick={onUnlockFirstName}
                        >
                          <PencilIcon />
                        </InputGroupButton>
                      </TooltipTrigger>
                      <TooltipContent>Edit first name.</TooltipContent>
                    </Tooltip>
                  </InputGroupAddon>
                )}
              </InputGroup>
              <FieldError errors={[errors.firstName]} />
            </Field>

            <Field className="min-w-0">
              <FieldLabel htmlFor="importLastName">Last name</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="importLastName"
                  disabled={!lastNameUnlocked}
                  aria-invalid={!!errors.lastName}
                  {...register("lastName")}
                />
                {!lastNameUnlocked && (
                  <InputGroupAddon align="inline-end">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <InputGroupButton
                          className="rounded-full"
                          size="icon-xs"
                          aria-label="Edit last name"
                          onClick={onUnlockLastName}
                        >
                          <PencilIcon />
                        </InputGroupButton>
                      </TooltipTrigger>
                      <TooltipContent>Edit last name.</TooltipContent>
                    </Tooltip>
                  </InputGroupAddon>
                )}
              </InputGroup>
              <FieldError errors={[errors.lastName]} />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="importEmail">Email</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="importEmail"
                value={selected?.primaryEmail ?? ""}
                disabled
                className="w-full"
              />
              <InputGroupAddon align="inline-end">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <InputGroupButton
                      className="rounded-full"
                      size="icon-xs"
                      aria-label="Email locked"
                    >
                      <LockIcon />
                    </InputGroupButton>
                  </TooltipTrigger>
                  <TooltipContent>
                    Workspace email cannot be changed during import.
                  </TooltipContent>
                </Tooltip>
              </InputGroupAddon>
            </InputGroup>
          </Field>
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Organization</FieldLegend>
        <FieldGroup>
          <Controller
            name="batchNumber"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Batch</FieldLabel>
                <BatchSelect
                  batches={batches}
                  value={field.value}
                  onChange={field.onChange}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          <Controller
            name="status"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Status</FieldLabel>
                <Select
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a status" />
                  </SelectTrigger>
                  <SelectContent>
                    {importableUserStatus.options.map((status) => (
                      <SelectItem key={status} value={status}>
                        {USER_STATUS_INFO[status].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          {shouldShowDepartment && (
            <Controller
              name="department"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Department</FieldLabel>
                  <Select
                    value={field.value ?? ""}
                    onValueChange={(v) =>
                      field.onChange(v === "__none__" ? null : v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Department (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
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

      {rootError && (
        <Alert variant="destructive" className="text-sm">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertTitle>Could not import member</AlertTitle>
          <AlertDescription>{rootError}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between gap-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" disabled={isSubmitDisabled || isPending}>
          {isPending ? "Importing..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
