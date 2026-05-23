import { ArrowLeftIcon, CircleCheck } from "lucide-react";
import Link from "next/link";
import React from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CANCEL_STEP_KEYS,
  CANCEL_STEP_META,
  type CancelStep,
  getStepIndex,
  isCancelStep,
} from "./cancel-steps";

interface CancelLayoutProps {
  params: Promise<{ step: string }>;
  children: React.ReactNode;
}

export default async function CancelLayout({
  children,
  params,
}: CancelLayoutProps) {
  const { step } = await params;
  const currentStep: CancelStep = isCancelStep(step) ? step : "confirm";
  const currentIndex = getStepIndex(currentStep);
  const meta = CANCEL_STEP_META[currentStep];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumb>
          <BreadcrumbList>
            {CANCEL_STEP_KEYS.map((key, index) => {
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
                      {CANCEL_STEP_META[key].label}
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
