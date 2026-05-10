import { CircleCheck } from "lucide-react";
import React from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { getActiveLegalMembership } from "@/db/membership";
import { getCurrentUser } from "@/db/user";
import { cn } from "@/lib/utils";
import {
  APPLICATION_STEP_KEYS,
  APPLICATION_STEP_META,
  type ApplicationStep,
  getStepIndex,
  isApplicationStep,
} from "./application-steps";

interface ApplicationStepLayoutProps {
  params: Promise<{ step: string }>;
  children: React.ReactNode;
}

export default async function ApplicationStepLayout({
  children,
  params,
}: ApplicationStepLayoutProps) {
  const { step } = await params;
  const currentStep: ApplicationStep = isApplicationStep(step)
    ? step
    : "personal-information";
  const currentIndex = getStepIndex(currentStep);
  const meta = APPLICATION_STEP_META[currentStep];

  const user = await getCurrentUser();
  const activeLegalMembership = user
    ? await getActiveLegalMembership(user.id)
    : null;
  const isReconfirmation =
    activeLegalMembership?.status === "membership_reconfirmation_pending";
  const subtitle =
    isReconfirmation && meta.reconfirmationSubtitle
      ? meta.reconfirmationSubtitle
      : meta.subtitle;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumb>
          <BreadcrumbList>
            {APPLICATION_STEP_KEYS.map((key, index) => {
              const isActive = index === currentIndex;
              const isCompleted = index < currentIndex;
              return (
                <React.Fragment key={key}>
                  {index > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem
                    className={cn(
                      "rounded-md px-[6px] py-[2px]",
                      isActive && "bg-muted",
                    )}
                  >
                    <BreadcrumbPage
                      className={cn(
                        "flex items-center gap-1 font-regular",
                        !isActive && !isCompleted && "text-muted-foreground",
                      )}
                    >
                      {isCompleted && (
                        <CircleCheck className="size-4 fill-success text-primary-foreground" />
                      )}
                      {APPLICATION_STEP_META[key].label}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </React.Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {meta.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
