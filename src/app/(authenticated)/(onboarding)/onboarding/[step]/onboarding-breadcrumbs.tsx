import { CircleCheck } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { ONBOARDING_STEPS, type OnboardingStep } from "./(steps)";

interface OnboardingBreadcrumbStepProp {
  title: string;
  isCompleted?: boolean;
  isActive?: boolean;
}

function OnboardingBreadcrumbStep({
  title,
  isCompleted,
  isActive,
}: OnboardingBreadcrumbStepProp) {
  return (
    <BreadcrumbItem
      className={cn("rounded-md px-[6px] py-[2px]", isActive && "bg-muted")}
    >
      <BreadcrumbPage
        className={cn(
          "flex items-center justify-center gap-1 font-regular",
          !isActive && !isCompleted && "text-muted-foreground",
        )}
      >
        {isCompleted && (
          <CircleCheck className="size-4 fill-success text-primary-foreground" />
        )}
        {title}
      </BreadcrumbPage>
    </BreadcrumbItem>
  );
}

interface OnboardingBreadcrumbsProps {
  currentStep: OnboardingStep;
}

export default function OnboardingBreadcrumbs({
  currentStep,
}: OnboardingBreadcrumbsProps) {
  const atWelcome = currentStep === ONBOARDING_STEPS.WELCOME;

  const atAccountSetup =
    currentStep === ONBOARDING_STEPS.MASTER_DATA ||
    currentStep === ONBOARDING_STEPS.ADDRESS;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <OnboardingBreadcrumbStep title="Sign up" isCompleted />
        <BreadcrumbSeparator />
        <OnboardingBreadcrumbStep
          title="Welcome"
          isActive={atWelcome}
          isCompleted={atAccountSetup}
        />
        <BreadcrumbSeparator />
        <OnboardingBreadcrumbStep
          title="Your account"
          isActive={atAccountSetup}
          isCompleted={false}
        />
      </BreadcrumbList>
    </Breadcrumb>
  );
}
