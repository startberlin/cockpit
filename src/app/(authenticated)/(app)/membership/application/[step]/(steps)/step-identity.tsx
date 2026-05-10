"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import type { MembershipApplicationDeclarations } from "@/db/schema/membership-application";
import { handleError } from "@/lib/utils";
import { saveIdentityDeclarationsAction } from "./step-identity-action";

const identityFormSchema = z.object({
  naturalPerson: z.literal(true),
  legalCapacity: z.literal(true),
});

type IdentityFormData = z.infer<typeof identityFormSchema>;

interface StepIdentityProps {
  legalMembershipId: string;
  declarations?: MembershipApplicationDeclarations | null;
}

export function StepIdentity({
  legalMembershipId,
  declarations,
}: StepIdentityProps) {
  const router = useRouter();

  const form = useForm<IdentityFormData>({
    resolver: zodResolver(identityFormSchema),
    defaultValues: {
      naturalPerson: declarations?.naturalPerson ?? undefined,
      legalCapacity: declarations?.legalCapacity ?? undefined,
    },
    mode: "onChange",
  });

  const { execute, isPending } = useAction(saveIdentityDeclarationsAction, {
    onSuccess: () => router.push("/membership/application/bylaws"),
    onError: handleError,
  });

  const onSubmit = () => {
    execute({ legalMembershipId });
  };

  return (
    <form
      className="flex flex-col gap-y-8"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <FieldSet>
        <FieldGroup>
          {(
            [
              {
                name: "naturalPerson" as const,
                label: "I confirm that I am a natural person.",
              },
              {
                name: "legalCapacity" as const,
                label: "I confirm that I have full legal capacity.",
              },
            ] satisfies { name: keyof IdentityFormData; label: string }[]
          ).map(({ name, label }) => (
            <Controller
              key={name}
              name={name}
              control={form.control}
              render={({ field }) => (
                <Field orientation="horizontal">
                  <Checkbox
                    id={name}
                    checked={field.value === true}
                    onCheckedChange={(checked) =>
                      field.onChange(checked === true ? true : undefined)
                    }
                  />
                  <FieldLabel htmlFor={name}>{label}</FieldLabel>
                </Field>
              )}
            />
          ))}
        </FieldGroup>
      </FieldSet>

      <Button type="submit" disabled={!form.formState.isValid || isPending}>
        Next
      </Button>
    </form>
  );
}
