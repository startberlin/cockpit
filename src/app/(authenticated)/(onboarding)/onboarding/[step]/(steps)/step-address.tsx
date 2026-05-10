"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import { InfoIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { AddressFields } from "@/components/address-fields";
import { Button } from "@/components/ui/button";
import { FieldDescription } from "@/components/ui/field";
import type { User } from "@/db/schema/auth";
import { authClient } from "@/lib/auth-client";
import { getDefaultCountry } from "@/lib/countries";
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
    if (!session?.data?.user) {
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
          country: getDefaultCountry(user.country),
        },
        mode: "onChange",
      },
    },
  );

  return (
    <div className="p-0">
      <FieldDescription className="flex flex-row gap-1.5 pt-0.5 text-xs mb-6">
        <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        We only show this to people who need it for administration.
      </FieldDescription>
      <form className="flex flex-col gap-y-8" onSubmit={handleSubmitWithAction}>
        <AddressFields
          control={form.control}
          setValue={form.setValue}
          disabled={action.isPending}
        />
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
