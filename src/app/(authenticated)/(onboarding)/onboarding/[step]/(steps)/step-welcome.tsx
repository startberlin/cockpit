"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ONBOARDING_STEPS } from ".";

export function StepWelcome() {
  const router = useRouter();

  function goToNext() {
    router.push(`/onboarding/${ONBOARDING_STEPS.MASTER_DATA}`);
  }
  return (
    <div className="flex flex-col gap-y-8 items-start">
      <Button type="button" onClick={goToNext}>
        Set up my account
      </Button>
    </div>
  );
}
