import Image from "next/image";
import { redirect } from "next/navigation";
import type React from "react";
import Logo from "@/app/logo-black.png";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/db/user";
import { getOnboardingProgress } from "@/schema/onboarding-progress";
import { ALL_STEPS, type OnboardingStep, STEP_DEFINITIONS } from "./(steps)";
import OnboardingBreadcrumbs from "./onboarding-breadcrumbs";

export async function generateStaticParams() {
  return ALL_STEPS.map((step) => ({ step }));
}

interface OnboardingStepLayoutProps {
  params: Promise<{
    step: OnboardingStep;
  }>;
  children: React.ReactNode;
}

export default async function OnboardingStepLayout({
  children,
  params,
}: OnboardingStepLayoutProps) {
  const { step } = await params;

  const user = await getCurrentUser();

  if (!user) {
    return redirect("/auth");
  }

  const onboardingProgress = getOnboardingProgress(user);
  console.log(onboardingProgress);

  if (onboardingProgress === "completed") {
    return redirect("/");
  }

  const stepDef = STEP_DEFINITIONS[step as OnboardingStep];

  return (
    <div className="flex min-h-screen flex-1 flex-col md:justify-center px-6 md:px-4 py-6 md:py-10 lg:px-6">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mt-6">
          <OnboardingBreadcrumbs currentStep={step} />
        </div>
        <span className="flex flex-col mt-6 gap-3">
          <Card>
            <CardHeader className="flex flex-col gap-4">
              <div className="flex items-center">
                <Image src={Logo} alt="START Berlin" className="h-7 w-auto" />
              </div>
              <CardTitle>{stepDef.title}</CardTitle>
              <CardDescription>{stepDef.description}</CardDescription>
            </CardHeader>
            <CardContent>{children}</CardContent>
          </Card>
        </span>
      </div>
    </div>
  );
}
