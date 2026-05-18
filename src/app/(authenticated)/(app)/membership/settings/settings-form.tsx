"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import { AlertCircleIcon, LockIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, useWatch } from "react-hook-form";
import { AddressFields } from "@/components/address-fields";
import { PhoneNumberInput } from "@/components/phone-number-input";
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
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { User } from "@/db/schema/auth";
import { handleError } from "@/lib/utils";
import { saveSettingsAction } from "./save-settings-action";
import { settingsSchema } from "./settings-validation";

const EVENT_EMAIL_PREF_STATUSES = ["onboarding", "member", "supporting_alumni"];

interface SettingsFormProps {
  user: User;
}

export function SettingsForm({ user }: SettingsFormProps) {
  const router = useRouter();

  const showEmailPreference = EVENT_EMAIL_PREF_STATUSES.includes(user.status);

  const { form, handleSubmitWithAction, action } = useHookFormAction(
    saveSettingsAction,
    zodResolver(settingsSchema),
    {
      actionProps: {
        onSuccess: () => router.push("/membership"),
        onError: handleError,
      },
      formProps: {
        defaultValues: {
          personalEmail: user.personalEmail ?? "",
          phone: user.phone ?? "",
          street: user.street ?? "",
          city: user.city ?? "",
          state: user.state ?? "",
          zip: user.zip ?? "",
          country: user.country ?? "",
          eventEmailPreference: user.eventEmailPreference ?? undefined,
        },
      },
    },
  );

  const watchedPersonalEmail = useWatch({
    control: form.control,
    name: "personalEmail",
  });

  return (
    <form className="flex flex-col gap-y-8" onSubmit={handleSubmitWithAction}>
      <FieldSet>
        <FieldLegend>Account</FieldLegend>
        <FieldGroup>
          <Field>
            <FieldLabel>START Berlin email</FieldLabel>
            <InputGroup>
              <InputGroupInput value={user.email} disabled className="w-full" />
              <InputGroupAddon align="inline-end">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <InputGroupButton className="rounded-full" size="icon-xs">
                      <LockIcon />
                    </InputGroupButton>
                  </TooltipTrigger>
                  <TooltipContent>
                    Your START Berlin email is managed by START Berlin and
                    cannot be changed here.
                  </TooltipContent>
                </Tooltip>
              </InputGroupAddon>
            </InputGroup>
          </Field>
          <Controller
            name="personalEmail"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Personal email</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  type="email"
                  aria-invalid={fieldState.invalid}
                  placeholder="you@email.com"
                  disabled={action.isPending}
                />
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
      <AddressFields
        control={form.control}
        setValue={form.setValue}
        disabled={action.isPending}
      />
      {showEmailPreference && (
        <FieldSet>
          <FieldLegend>Event invites</FieldLegend>
          <p className="text-sm text-muted-foreground -mt-2">
            We send invites for all our events by email. Choose which address
            you'd like us to use so you always know what's happening.
          </p>
          <FieldGroup>
            <Controller
              name="eventEmailPreference"
              control={form.control}
              render={({ field }) => (
                <RadioGroup
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                  disabled={action.isPending}
                  className="gap-3"
                >
                  <div className="flex items-start gap-3">
                    <RadioGroupItem
                      value="personal_email"
                      id="pref-personal"
                      className="mt-0.5"
                    />
                    <Label
                      htmlFor="pref-personal"
                      className="flex items-start flex-col gap-0.5 cursor-pointer"
                    >
                      <span className="font-medium">
                        {watchedPersonalEmail ||
                          user.personalEmail ||
                          "No personal email set"}
                      </span>
                      <span className="font-normal text-muted-foreground text-xs">
                        Personal email
                      </span>
                    </Label>
                  </div>
                  <div className="flex items-start gap-3">
                    <RadioGroupItem
                      value="start_email"
                      id="pref-start"
                      className="mt-0.5"
                    />
                    <Label
                      htmlFor="pref-start"
                      className="flex items-start flex-col gap-0.5 cursor-pointer"
                    >
                      <span className="font-medium">{user.email}</span>
                      <span className="font-normal text-muted-foreground text-xs">
                        START Berlin email
                      </span>
                    </Label>
                  </div>
                </RadioGroup>
              )}
            />
          </FieldGroup>
        </FieldSet>
      )}
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
        Save changes
      </Button>
    </form>
  );
}
