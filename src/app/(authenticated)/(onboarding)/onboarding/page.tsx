import { redirect } from "next/navigation";
import { getCurrentUser } from "@/db/user";
import { getOnboardingProgress } from "@/schema/onboarding-progress";
import { ONBOARDING_STEPS } from "./[step]/(steps)";

export default async function OnboardingRoot() {
  const user = await getCurrentUser();

  if (!user) {
    return redirect("/auth");
  }

  const progress = getOnboardingProgress(user);

  if (progress === "completed") {
    return redirect("/");
  }

  if (progress === "event-email") {
    return redirect(`/onboarding/${ONBOARDING_STEPS.EVENT_EMAIL}`);
  }

  return redirect(`/onboarding/${ONBOARDING_STEPS.MASTER_DATA}`);
}
