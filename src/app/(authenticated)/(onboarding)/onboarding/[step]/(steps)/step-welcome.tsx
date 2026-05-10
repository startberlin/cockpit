"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { User } from "@/db/schema/auth";
import { ONBOARDING_STEPS } from ".";

interface StepWelcomeProps {
  user: User;
}

export function StepWelcome({ user: _user }: StepWelcomeProps) {
  const router = useRouter();

  function goToNext() {
    router.push(`/onboarding/${ONBOARDING_STEPS.MASTER_DATA}`);
  }

  return (
    <div className="flex flex-col gap-y-4 items-start">
      <Button type="button" onClick={goToNext}>
        Set up my account
      </Button>
    </div>
  );
}
