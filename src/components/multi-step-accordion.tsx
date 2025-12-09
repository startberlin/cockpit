"use client";

import { CheckCircle2 } from "lucide-react";
import * as React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

export type StepItem = {
  value?: string;
  title: string;
  status: "complete" | "current" | "upcoming";
  content?: React.ReactNode;
};

export type MultiStepAccordionProps = {
  steps: StepItem[];
  className?: string;
};

function toSlug(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function MultiStepAccordion({
  steps,
  className,
}: MultiStepAccordionProps) {
  type NormalizedStepItem = StepItem & { value: string };
  const normalizedSteps: NormalizedStepItem[] = React.useMemo(() => {
    return steps.map((s, idx) => {
      const value = s.value ?? `${toSlug(s.title) || "step"}-${idx + 1}`;
      return { ...s, value };
    });
  }, [steps]);

  const firstCurrent = React.useMemo(() => {
    return normalizedSteps.find((s) => s.status === "current");
  }, [normalizedSteps]);

  const defaultValue: string | undefined = firstCurrent
    ? firstCurrent.value
    : undefined;

  return (
    <Accordion
      type="single"
      value={defaultValue}
      className={cn("w-full space-y-2 my-0!", className)}
    >
      {normalizedSteps.map((step) => {
        const isComplete = step.status === "complete";
        const isCurrent = step.status === "current";
        const isUpcoming = step.status === "upcoming";

        return (
          <AccordionItem
            key={step.value}
            value={step.value}
            disabled={isUpcoming}
            className="rounded-md border px-4 last:border-b-1"
          >
            <AccordionTrigger className="hover:no-underline cursor-pointer">
              <div className="flex items-center gap-2">
                {isComplete ? (
                  <span
                    className="flex size-5 items-center justify-center"
                    aria-hidden
                  >
                    <CheckCircle2
                      className="size-6 shrink-0 text-white fill-emerald-500"
                      aria-hidden
                    />
                  </span>
                ) : (
                  <span
                    className={cn("size-5 shrink-0 rounded-full border")}
                    aria-hidden
                  />
                )}
                <p
                  className={cn(
                    "text-sm font-medium",
                    isComplete || isCurrent
                      ? "text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {step.title}
                </p>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-3">{step.content}</AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

export default MultiStepAccordion;
