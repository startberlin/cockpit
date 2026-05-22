import { CircleCheck } from "lucide-react";
import React from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import {
  BECOME_ALUMNI_STEP_META,
  type BecomeAlumniStep,
  getBreadcrumbSteps,
  isBecomeAlumniStep,
} from "./become-alumni-steps";

interface BecomeAlumniLayoutProps {
  params: Promise<{ step: string }>;
  children: React.ReactNode;
}

export default async function BecomeAlumniLayout({
  children,
  params,
}: BecomeAlumniLayoutProps) {
  const { step } = await params;
  const currentStep: BecomeAlumniStep = isBecomeAlumniStep(step)
    ? step
    : "supporting-alumni";
  const breadcrumbSteps = getBreadcrumbSteps(currentStep);
  const meta = BECOME_ALUMNI_STEP_META[currentStep];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbSteps.map((key, index) => {
              const isActive = key === currentStep;
              const isCompleted = index < breadcrumbSteps.indexOf(currentStep);
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
                        "flex gap-1 font-regular",
                        !isActive && !isCompleted && "text-muted-foreground",
                      )}
                    >
                      {isCompleted && (
                        <CircleCheck className="size-4 fill-success text-primary-foreground" />
                      )}
                      {BECOME_ALUMNI_STEP_META[key].label}
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
          <p className="text-sm text-muted-foreground mt-1">{meta.subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
