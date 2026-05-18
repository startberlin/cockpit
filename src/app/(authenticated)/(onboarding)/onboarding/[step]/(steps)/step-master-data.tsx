"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import { AlertCircleIcon, InfoIcon, LockIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { Controller } from "react-hook-form";
import { PhoneNumberInput } from "@/components/phone-number-input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { User } from "@/db/schema/auth";
import { authClient } from "@/lib/auth-client";
import { handleError } from "@/lib/utils";
import { stepMasterDataSchema } from "../onboarding-validation";
import { completeOnboardingMasterDataStep } from "./step-master-data-action";

const EVENT_EMAIL_PREF_STATUSES = [
  "onboarding",
  "member",
  "supporting_alumni",
] as const satisfies readonly User["status"][];

interface StepMasterDataProps {
  user: User;
}

export function StepMasterData({ user }: StepMasterDataProps) {
  const session = authClient.useSession();
  const router = useRouter();

  const onCompletedStep = useCallback(() => {
    if (!session?.data?.user) {
      console.error("User not loaded/signed in. Can't refresh page.");
      return;
    }
    const needsEventEmailStep = (
      EVENT_EMAIL_PREF_STATUSES as readonly string[]
    ).includes(user.status);
    router.push(needsEventEmailStep ? "/onboarding/event-invites" : "/");
  }, [router, session, user.status]);

  const { form, handleSubmitWithAction, action } = useHookFormAction(
    completeOnboardingMasterDataStep,
    zodResolver(stepMasterDataSchema),
    {
      actionProps: {
        onSuccess: onCompletedStep,
        onError: handleError,
      },
      formProps: {
        defaultValues: {
          personalEmail: user.personalEmail ?? "",
          phone: user.phone ?? "",
          birthDate: user.birthDate ?? "",
        },
      },
    },
  );

  return (
    <div className="p-0">
      <form className="flex flex-col gap-y-8" onSubmit={handleSubmitWithAction}>
        <FieldSet>
          <FieldLegend>Account Information</FieldLegend>
          <FieldGroup>
            <div className="flex gap-4">
              <Field className="flex-1">
                <FieldLabel htmlFor="firstName">First Name</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    value={user.firstName}
                    disabled
                    className="w-full"
                  />
                  <InputGroupAddon align="inline-end">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <InputGroupButton
                          className="rounded-full"
                          size="icon-xs"
                        >
                          <LockIcon />
                        </InputGroupButton>
                      </TooltipTrigger>
                      <TooltipContent>You cannot change this.</TooltipContent>
                    </Tooltip>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
              <Field className="flex-1">
                <FieldLabel htmlFor="lastName">Last Name</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    value={user.lastName}
                    disabled
                    className="w-full"
                  />
                  <InputGroupAddon align="inline-end">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <InputGroupButton
                          className="rounded-full"
                          size="icon-xs"
                        >
                          <LockIcon />
                        </InputGroupButton>
                      </TooltipTrigger>
                      <TooltipContent>You cannot change this.</TooltipContent>
                    </Tooltip>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  value={user.email}
                  disabled
                  className="w-full"
                />
                <InputGroupAddon align="inline-end">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <InputGroupButton className="rounded-full" size="icon-xs">
                        <LockIcon />
                      </InputGroupButton>
                    </TooltipTrigger>
                    <TooltipContent>You cannot change this.</TooltipContent>
                  </Tooltip>
                </InputGroupAddon>
              </InputGroup>
            </Field>
            <Controller
              name="personalEmail"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Personal Email</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    type="email"
                    aria-invalid={fieldState.invalid}
                    placeholder="you@email.com"
                    disabled={action.isPending}
                  />
                  <FieldDescription className="flex flex-row gap-1.5 pt-0.5 text-xs">
                    <InfoIcon className="h-3.5 w-3.5 shrink-0" />
                    Use a personal email address you'll keep long-term. Avoid
                    school or work addresses that you might lose access to
                    later.
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="phone"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Phone</FieldLabel>
                  <PhoneNumberInput
                    {...field}
                    id={field.name}
                    defaultCountry="DE"
                    aria-invalid={fieldState.invalid}
                    placeholder="e.g. +4912345678"
                    disabled={action.isPending}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="birthDate"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Date of Birth</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    type="date"
                    aria-invalid={fieldState.invalid}
                    disabled={action.isPending}
                    className="max-w-full"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
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
        <Button
          type="submit"
          disabled={!form.formState.isValid || action.isPending}
        >
          Next
        </Button>
      </form>
    </div>
  );
}
