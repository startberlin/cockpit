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
import { ONBOARDING_STEPS } from ".";
import { completeOnboardingMasterDataStep } from "./step-master-data-action";

interface StepMasterDataProps {
  user: User;
}

export function StepMasterData({ user }: StepMasterDataProps) {
  console.log(user);
  const session = authClient.useSession();
  const router = useRouter();

  const onCompletedStep = useCallback(() => {
    if (!session || !session.data || !session.data.user) {
      console.error("User not loaded/signed in. Can't refresh page.");
      return;
    }

    router.push(`/onboarding/${ONBOARDING_STEPS.ADDRESS}`);
  }, [router, session]);

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
          personalEmail: "",
          phone: user.phone ?? "",
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
            {/* Editable fields using Controller */}
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
                    <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Use a personal email you’ll keep long-term (not a school or
                    work address).
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
