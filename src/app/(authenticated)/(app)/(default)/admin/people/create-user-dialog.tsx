"use client";

import { CircleCheck, FileUpIcon, UserPlusIcon } from "lucide-react";
import * as React from "react";
import { CreateUserForm } from "@/components/create-user-form";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CsvBatchStep } from "./create-user-csv-step";

type DialogStep = "method" | "create" | "csv";

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batches: { number: number }[];
  onSuccess?: () => void;
}

const STEP_CONFIG = {
  create: {
    breadcrumbs: ["Method", "Create"],
    title: "Add member",
    description:
      "Add a member and send their invitation to the personal email address below. START Cockpit will prepare their START Berlin account.",
  },
  csv: {
    breadcrumbs: ["Method", "Upload"],
    title: "Import from CSV",
    description:
      "Upload a CSV to create multiple members at once. Invalid rows will be flagged before processing starts.",
  },
} as const;

export function CreateUserDialog({
  open,
  onOpenChange,
  batches,
  onSuccess,
}: CreateUserDialogProps) {
  const [step, setStep] = React.useState<DialogStep>("method");

  React.useEffect(() => {
    if (!open) setStep("method");
  }, [open]);

  const config = step !== "method" ? STEP_CONFIG[step] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="gap-4">
          {config && (
            <Breadcrumb>
              <BreadcrumbList>
                {config.breadcrumbs.map((label, index) => {
                  const isActive = index === config.breadcrumbs.length - 1;
                  const isCompleted = !isActive;
                  return (
                    <React.Fragment key={label}>
                      {index > 0 && <BreadcrumbSeparator />}
                      <BreadcrumbItem
                        className={cn(
                          "rounded-md px-1.5 py-0.5",
                          isActive && "bg-muted",
                        )}
                      >
                        <BreadcrumbPage
                          className={cn(
                            "flex items-center gap-1 font-regular",
                            !isActive &&
                              !isCompleted &&
                              "text-muted-foreground",
                          )}
                        >
                          {isCompleted && (
                            <CircleCheck className="size-4 fill-success text-primary-foreground" />
                          )}
                          {label}
                        </BreadcrumbPage>
                      </BreadcrumbItem>
                    </React.Fragment>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>
          )}
          <div className="flex flex-col gap-2">
            <DialogTitle>{config?.title ?? "Add member"}</DialogTitle>
            <DialogDescription>
              {config?.description ?? "Choose how you want to add a member."}
            </DialogDescription>
          </div>
        </DialogHeader>

        {step === "method" && (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setStep("create")}
              className="flex items-start gap-4 rounded-lg border p-4 text-left transition-colors hover:bg-accent"
            >
              <UserPlusIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Create a single user</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Fill in a form to add one member at a time.
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setStep("csv")}
              className="flex items-start gap-4 rounded-lg border p-4 text-left transition-colors hover:bg-accent"
            >
              <FileUpIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Import from CSV</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Upload a CSV file to create multiple members at once.
                </p>
              </div>
            </button>
          </div>
        )}

        {step === "create" && (
          <CreateUserForm
            batches={batches}
            onBack={() => setStep("method")}
            onSuccess={() => {
              onOpenChange(false);
              onSuccess?.();
            }}
          />
        )}

        {step === "csv" && (
          <CsvBatchStep
            batches={batches}
            onBack={() => setStep("method")}
            onSuccess={() => {
              onOpenChange(false);
              onSuccess?.();
            }}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
