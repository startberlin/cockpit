"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import { InfoIcon, LockIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { Controller } from "react-hook-form";
import { AddressFields } from "@/components/address-fields";
import { PhoneNumberInput } from "@/components/phone-number-input";
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
import { getDefaultCountry } from "@/lib/countries";
import { handleError } from "@/lib/utils";
import { applicationPersonalInfoSchema } from "../application-validation";
import { saveApplicationPersonalInfoAction } from "./step-address-action";

interface StepPersonalInformationProps {
  user: User;
  legalMembershipId: string;
  isReconfirmation?: boolean;
}

export function StepPersonalInformation({
  user,
  legalMembershipId,
  isReconfirmation = false,
}: StepPersonalInformationProps) {
  const router = useRouter();
  const onSuccess = useCallback(() => {
    router.push("/membership/application/identity");
  }, [router]);

  const { form, handleSubmitWithAction, action } = useHookFormAction(
    saveApplicationPersonalInfoAction,
    zodResolver(applicationPersonalInfoSchema),
    {
      actionProps: {
        onSuccess,
        onError: handleError,
      },
      formProps: {
        defaultValues: {
          legalMembershipId,
          personalEmail: user.personalEmail ?? "",
          phone: user.phone ?? "",
          birthDate: user.birthDate ?? "",
          street: user.street ?? "",
          city: user.city ?? "",
          state: user.state ?? "",
          zip: user.zip ?? "",
          country: getDefaultCountry(user.country),
        },
        mode: "onChange",
      },
    },
  );

  return (
    <form className="flex flex-col gap-y-8" onSubmit={handleSubmitWithAction}>
      <FieldSet>
        <FieldLegend>Name</FieldLegend>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>First Name</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  value={user.firstName}
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
                    <TooltipContent>
                      Your name can't be changed here. Contact the board if
                      needed.
                    </TooltipContent>
                  </Tooltip>
                </InputGroupAddon>
              </InputGroup>
            </Field>
            <Field>
              <FieldLabel>Last Name</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  value={user.lastName}
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
                    <TooltipContent>
                      Your name can't be changed here. Contact the board if
                      needed.
                    </TooltipContent>
                  </Tooltip>
                </InputGroupAddon>
              </InputGroup>
            </Field>
          </div>
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Contact</FieldLegend>
        <FieldGroup>
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
                  Use a personal email you'll keep long-term — not a school or
                  work address.
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
                <FieldLabel htmlFor={field.name}>Phone Number</FieldLabel>
                <PhoneNumberInput
                  {...field}
                  id={field.name}
                  defaultCountry="DE"
                  aria-invalid={fieldState.invalid}
                  placeholder="+49 123 456 789"
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

      <FieldSet>
        <FieldLegend>Birthdate</FieldLegend>
        <FieldGroup>
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

      <AddressFields
        control={form.control}
        setValue={form.setValue}
        disabled={action.isPending}
      />

      <Button
        type="submit"
        disabled={!form.formState.isValid || action.isPending}
      >
        Next
      </Button>
    </form>
  );
}
