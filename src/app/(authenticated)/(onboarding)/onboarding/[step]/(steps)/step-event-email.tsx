"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import { AlertCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller } from "react-hook-form";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { User } from "@/db/schema/auth";
import { handleError } from "@/lib/utils";
import { saveEventEmailPreferenceAction } from "./step-event-email-action";

const schema = z.object({
  eventEmailPreference: z.enum(["personal_email", "start_email"], {
    message: "Please choose which email address to use for event invites.",
  }),
});

interface StepEventEmailProps {
  user: User;
}

export function StepEventEmail({ user }: StepEventEmailProps) {
  const router = useRouter();

  const { form, handleSubmitWithAction, action } = useHookFormAction(
    saveEventEmailPreferenceAction,
    zodResolver(schema),
    {
      actionProps: {
        onSuccess: () => router.push("/"),
        onError: handleError,
      },
      formProps: {
        defaultValues: {
          eventEmailPreference: user.eventEmailPreference ?? undefined,
        },
      },
    },
  );

  return (
    <form className="flex flex-col gap-y-8" onSubmit={handleSubmitWithAction}>
      <Controller
        name="eventEmailPreference"
        control={form.control}
        render={({ field }) => (
          <RadioGroup
            value={field.value ?? ""}
            onValueChange={field.onChange}
            disabled={action.isPending}
            className="gap-4"
          >
            <div className="flex items-start gap-3">
              <RadioGroupItem
                value="start_email"
                id="pref-start"
                className="mt-0.5"
              />
              <Label
                htmlFor="pref-start"
                className="flex flex-col items-start gap-0.5 cursor-pointer"
              >
                <span className="font-medium">{user.email}</span>
                <span className="font-normal text-muted-foreground text-xs">
                  START Berlin email
                </span>
              </Label>
            </div>
            <div className="flex items-start gap-3">
              <RadioGroupItem
                value="personal_email"
                id="pref-personal"
                className="mt-0.5"
              />
              <Label
                htmlFor="pref-personal"
                className="flex flex-col items-start gap-0.5 cursor-pointer"
              >
                <span className="font-medium">
                  {user.personalEmail || "No personal email on file"}
                </span>
                <span className="font-normal text-muted-foreground text-xs">
                  Personal email
                </span>
              </Label>
            </div>
          </RadioGroup>
        )}
      />
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
  );
}
