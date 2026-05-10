"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  type ApplicationDeclarationsFormData,
  applicationDeclarationsSchema,
} from "../application-validation";

const DECLARATIONS: {
  name: keyof ApplicationDeclarationsFormData;
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

interface StepDeclarationsProps {
  legalMembershipId: string;
}

export function StepDeclarations({
  legalMembershipId: _,
}: StepDeclarationsProps) {
  const router = useRouter();

  const form = useForm<ApplicationDeclarationsFormData>({
    resolver: zodResolver(applicationDeclarationsSchema),
    defaultValues: {
      naturalPerson: undefined,
      legalCapacity: undefined,
      supportsPurpose: undefined,
      acceptsBylaws: undefined,
      acceptsPrivacyNotice: undefined,
      acknowledgesFee: undefined,
    },
  });

  const onSubmit = useCallback(() => {
    router.push("/membership/application/review");
  }, [router]);

  return (
    <div className="p-0">
      <form
        className="flex flex-col gap-y-8"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FieldSet>
          <FieldLegend>Declarations</FieldLegend>
          <FieldDescription className="text-xs -mt-2 mb-2">
            Please confirm all declarations to proceed with your application.
          </FieldDescription>
          <FieldGroup>
            {DECLARATIONS.map(({ name, label }) => (
              <Controller
                key={name}
                name={name}
                control={form.control}
                render={({ field }) => (
                  <Field orientation="horizontal">
                    <Checkbox
                      id={name}
                      checked={field.value === true}
                      onCheckedChange={(checked) => {
                        field.onChange(checked === true ? true : undefined);
                      }}
                    />
                    <FieldLabel htmlFor={name}>{label}</FieldLabel>
                  </Field>
                )}
              />
            ))}
          </FieldGroup>
        </FieldSet>
        <Button type="submit" disabled={!form.formState.isValid}>
          Next
        </Button>
      </form>
    </div>
  );
}
