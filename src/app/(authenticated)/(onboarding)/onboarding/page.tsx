import { redirect } from "next/navigation";
import { getCurrentUser } from "@/db/user";
import { getOnboardingProgress } from "@/schema/onboarding-progress";

export default async function OnboardingRoot() {
  const user = await getCurrentUser();

  if (!user) {
    return redirect("/auth");
  }

  const progress = getOnboardingProgress(user);

  if (progress === "completed") {
    return redirect("/");
  }

  return redirect(`/onboarding/${progress}`);
}
