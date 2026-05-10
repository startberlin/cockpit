"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import type { User } from "@/db/schema/auth";
import { handleError } from "@/lib/utils";
import { submitApplicationSchema } from "../application-validation";
import { submitApplicationAction } from "../submit-application-action";

const DECLARATIONS: {
  name: keyof typeof submitApplicationSchema.shape.declarations.shape;
  label: string;
}[] = [
  {
    name: "naturalPerson",
    label: "I confirm that I am a natural person.",
  },
  {
    name: "legalCapacity",
    label: "I confirm that I have full legal capacity.",
  },
  {
    name: "supportsPurpose",
    label: "I support the purpose of START Berlin e.V.",
  },
  {
    name: "acceptsBylaws",
    label: "I accept the bylaws of START Berlin e.V.",
  },
  {
    name: "acceptsPrivacyNotice",
    label: "I have read and accept the privacy notice.",
  },
  {
    name: "acknowledgesFee",
    label: "I acknowledge that a yearly membership fee of 40 EUR applies.",
  },
];

interface StepReviewProps {
  user: User;
  legalMembershipId: string;
}

export function StepReview({ user, legalMembershipId }: StepReviewProps) {
  const router = useRouter();

  const onSuccess = useCallback(() => {
    router.push("/membership");
  }, [router]);

  const { form, handleSubmitWithAction, action } = useHookFormAction(
    submitApplicationAction,
    zodResolver(submitApplicationSchema),
    {
      actionProps: {
        onSuccess,
        onError: handleError,
      },
      formProps: {
        defaultValues: {
          legalMembershipId,
          address: {
            street: user.street ?? "",
            city: user.city ?? "",
            state: user.state ?? "",
            zip: user.zip ?? "",
            country: user.country ?? "",
          },
          declarations: {
            naturalPerson: undefined,
            legalCapacity: undefined,
            supportsPurpose: undefined,
            acceptsBylaws: undefined,
            acceptsPrivacyNotice: undefined,
            acknowledgesFee: undefined,
          },
        },
      },
    },
  );

  return (
    <div className="p-0">
      <form className="flex flex-col gap-y-8" onSubmit={handleSubmitWithAction}>
        <input type="hidden" {...form.register("legalMembershipId")} />

        <FieldSet>
          <FieldLegend>Your Address</FieldLegend>
          <FieldDescription className="text-xs -mt-2 mb-2">
            This address will be recorded on your membership application.
          </FieldDescription>
          <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm leading-relaxed">
            <p>{user.street}</p>
            <p>
              {user.zip} {user.city}
            </p>
            {user.state && <p>{user.state}</p>}
            <p>{user.country}</p>
          </div>
        </FieldSet>

        <FieldSet>
          <FieldLegend>Declarations</FieldLegend>
          <FieldDescription className="text-xs -mt-2 mb-2">
            Please confirm all declarations to submit your application.
          </FieldDescription>
          <FieldGroup>
            {DECLARATIONS.map(({ name, label }) => (
              <Controller
                key={name}
                name={`declarations.${name}`}
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field
                    orientation="horizontal"
                    data-invalid={fieldState.invalid}
                  >
                    <Checkbox
                      id={`declarations.${name}`}
                      checked={field.value === true}
                      onCheckedChange={(checked) => {
                        field.onChange(checked === true ? true : undefined);
                      }}
                      disabled={action.isPending}
                    />
                    <FieldContent>
                      <FieldLabel htmlFor={`declarations.${name}`}>
                        {label}
                      </FieldLabel>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </FieldContent>
                  </Field>
                )}
              />
            ))}
          </FieldGroup>
        </FieldSet>

        <Button
          type="submit"
          disabled={!form.formState.isValid || action.isPending}
        >
          Submit Application
        </Button>
      </form>
    </div>
  );
}
