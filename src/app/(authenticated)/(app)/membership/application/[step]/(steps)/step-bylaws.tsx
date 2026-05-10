"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ExternalLinkIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import type { MembershipApplicationDeclarations } from "@/db/schema/membership-application";
import { SATZUNG_URL } from "@/lib/legal-documents/legal-document-paths";
import { handleError } from "@/lib/utils";
import { saveBylawsDeclarationsAction } from "./step-bylaws-action";

const bylawsFormSchema = z.object({
  supportsPurpose: z.literal(true),
  acceptsBylaws: z.literal(true),
});

type BylawsFormData = z.infer<typeof bylawsFormSchema>;

interface StepBylawsProps {
  legalMembershipId: string;
  declarations?: MembershipApplicationDeclarations | null;
}

export function StepBylaws({
  legalMembershipId,
  declarations,
}: StepBylawsProps) {
  const router = useRouter();

  const form = useForm<BylawsFormData>({
    resolver: zodResolver(bylawsFormSchema),
    defaultValues: {
      supportsPurpose: declarations?.supportsPurpose ?? undefined,
      acceptsBylaws: declarations?.acceptsBylaws ?? undefined,
    },
    mode: "onChange",
  });

  const { execute, isPending } = useAction(saveBylawsDeclarationsAction, {
    onSuccess: () => router.push("/membership/application/fees"),
    onError: handleError,
  });

  const onSubmit = () => {
    execute({ legalMembershipId });
  };

  return (
    <form
      className="flex flex-col gap-y-6"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <div className="flex flex-col gap-2">
        <iframe
          src={SATZUNG_URL}
          title="Satzung (bylaws) of START Berlin e.V."
          className="w-full h-96 rounded-md border"
        />
        <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            Satzung of START Berlin e.V.
          </span>
          <Button variant="ghost" size="sm" asChild>
            <a href={SATZUNG_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLinkIcon className="size-3.5" />
              Open in new tab
            </a>
          </Button>
        </div>
      </div>

      <FieldSet>
        <FieldGroup>
          {(
            [
              {
                name: "supportsPurpose" as const,
                label: "I support the purpose of START Berlin e.V.",
              },
              {
                name: "acceptsBylaws" as const,
                label: "I accept the bylaws (Satzung) of START Berlin e.V.",
              },
            ] satisfies { name: keyof BylawsFormData; label: string }[]
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
