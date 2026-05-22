"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { InfoIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { handleError } from "@/lib/utils";
import { saveAlumniCommunityAction } from "./save-alumni-community-action";

const schema = z.object({
  personalEmail: z
    .union([z.email("Please enter a valid email address."), z.literal("")])
    .optional(),
});

type FormData = z.infer<typeof schema>;

interface StepAlumniCommunityProps {
  currentPersonalEmail: string | null | undefined;
}

export function StepAlumniCommunity({
  currentPersonalEmail,
}: StepAlumniCommunityProps) {
  const router = useRouter();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { personalEmail: currentPersonalEmail ?? "" },
    mode: "onChange",
  });

  const { execute, isPending } = useAction(saveAlumniCommunityAction, {
    onSuccess: () => router.push("/membership/become-alumni/alumni-finalize"),
    onError: handleError,
  });

  return (
    <form
      className="flex flex-col gap-y-8"
      onSubmit={form.handleSubmit((values) => execute(values))}
    >
      <FieldSet>
        <FieldGroup>
          <Controller
            name="personalEmail"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  Personal email address
                </FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  type="email"
                  placeholder="you@example.com"
                  aria-invalid={fieldState.invalid}
                  disabled={isPending}
                />
                <FieldDescription className="flex flex-row gap-1.5 pt-0.5 text-xs">
                  <InfoIcon className="h-3.5 w-3.5 shrink-0" />
                  If you would not like to join the alumni community, please
                  cancel your membership instead.
                </FieldDescription>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </FieldGroup>
      </FieldSet>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            router.push("/membership/become-alumni/alumni-confirm")
          }
          disabled={isPending}
        >
          Back
        </Button>
        <Button type="submit" disabled={!form.formState.isValid || isPending}>
          {isPending ? "Saving…" : "Continue"}
        </Button>
      </div>
    </form>
  );
}
