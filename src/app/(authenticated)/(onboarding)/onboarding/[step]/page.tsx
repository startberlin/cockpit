import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/db/user";
import { getOnboardingProgress } from "@/schema/onboarding-progress";
import { type OnboardingStep, STEP_DEFINITIONS } from "./(steps)";

interface OnboardingPageProps {
  params: Promise<{
    step: string;
  }>;
}

export default async function Onboarding({ params }: OnboardingPageProps) {
  const { step } = await params;

  const user = await getCurrentUser();

  if (!user) {
    return redirect("/auth");
  }

  const onboardingStatus = getOnboardingProgress(user);

  if (onboardingStatus === "completed") {
    return redirect("/");
  }

  const stepDef = STEP_DEFINITIONS[step as OnboardingStep];

  if (!stepDef) {
    notFound();
  }

  const StepComponent = stepDef.component;

  return <StepComponent user={user} />;
}
