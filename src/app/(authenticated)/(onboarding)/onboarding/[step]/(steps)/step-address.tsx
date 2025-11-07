"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import { InfoIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { Controller } from "react-hook-form";
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
import type { User } from "@/db/schema/auth";
import { authClient } from "@/lib/auth-client";
import { handleError } from "@/lib/utils";
import { stepAddressDataSchema } from "../onboarding-validation";
import { completeOnboardingAddressStep } from "./step-address-action";

interface StepAddressProps {
  user: User;
}

export function StepAddress({ user }: StepAddressProps) {
  const session = authClient.useSession();
  const router = useRouter();

  const onCompletedStep = useCallback(() => {
    if (!session || !session.data || !session.data.user) {
      console.error("User not loaded/signed in. Can't refresh page.");
      return;
    }
    router.push("/");
  }, [router, session]);

  const { form, handleSubmitWithAction, action } = useHookFormAction(
    completeOnboardingAddressStep,
    zodResolver(stepAddressDataSchema),
    {
      actionProps: {
        onSuccess: onCompletedStep,
        onError: handleError,
      },
      formProps: {
        defaultValues: {
          street: user.street ?? "",
          city: user.city ?? "",
          state: user.state ?? "",
          zip: user.zip ?? "",
          country: user.country ?? "",
        },
      },
    },
  );

  return (
    <div className="p-0">
      <FieldDescription className="flex flex-row gap-1.5 pt-0.5 text-xs mb-6">
        <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Your information is only visible on a need-to-know basis and handled
        securely.
      </FieldDescription>
      <form className="flex flex-col gap-y-8" onSubmit={handleSubmitWithAction}>
        <FieldSet>
          <FieldLegend>Address</FieldLegend>
          <FieldGroup>
            <Controller
              name="street"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Street</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    disabled={action.isPending}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="city"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>City</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    disabled={action.isPending}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="state"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>State</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    disabled={action.isPending}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="zip"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Zip Code</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    disabled={action.isPending}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="country"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Country</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    aria-invalid={fieldState.invalid}
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
        <Button
          type="submit"
          disabled={!form.formState.isValid || action.isPending}
        >
          Finish
        </Button>
      </form>
    </div>
  );
}
