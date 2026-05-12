"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import { CircleCheck } from "lucide-react";
import * as React from "react";
import { FormProvider, useWatch } from "react-hook-form";
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
import { cn, handleError } from "@/lib/utils";
import { importGoogleWorkspaceUserAction } from "./import-google-user-action";
import { BrowseStep } from "./import-google-user-browse-step";
import { MembershipStep } from "./import-google-user-membership-step";
import { ProfileStep } from "./import-google-user-profile-step";
import {
  type ImportGoogleWorkspaceUserData,
  importGoogleWorkspaceUserSchema,
} from "./import-google-user-schema";
import type {
  WizardStep,
  WorkspaceCandidate,
} from "./import-google-user-types";

interface ImportGoogleUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batches: { number: number }[];
  onSuccess?: () => void;
}

export function ImportGoogleUserDialog({
  open,
  onOpenChange,
  batches,
  onSuccess,
}: ImportGoogleUserDialogProps) {
  const [step, setStep] = React.useState<WizardStep>("browse");
  const [selected, setSelected] = React.useState<WorkspaceCandidate | null>(
    null,
  );
  const [firstNameUnlocked, setFirstNameUnlocked] = React.useState(false);
  const [lastNameUnlocked, setLastNameUnlocked] = React.useState(false);

  const defaultValues = React.useMemo<ImportGoogleWorkspaceUserData>(
    () => ({
      googleWorkspaceUserId: "",
      firstName: "",
      lastName: "",
      batchNumber: undefined,
      department: null,
      status: "member" as const,
      paidThroughDate: "",
    }),
    [],
  );

  const { form, action } = useHookFormAction(
    importGoogleWorkspaceUserAction,
    React.useMemo(() => zodResolver(importGoogleWorkspaceUserSchema), []),
    {
      actionProps: {
        onSuccess: () => {
          onOpenChange(false);
          onSuccess?.();
        },
        onError: handleError,
      },
      formProps: {
        defaultValues,
        mode: "onChange",
      },
    },
  );

  const selectedStatus = useWatch({
    control: form.control,
    name: "status",
  });
  const requiresMembershipStep =
    selectedStatus === "member" || selectedStatus === "supporting_alumni";

  const selectWorkspaceUser = (candidate: WorkspaceCandidate) => {
    if (candidate.linkedUser || candidate.suspended) return;
    setSelected(candidate);
    setFirstNameUnlocked(false);
    setLastNameUnlocked(false);
    form.setValue("googleWorkspaceUserId", candidate.id, {
      shouldValidate: true,
    });
    form.setValue("firstName", candidate.givenName, { shouldValidate: true });
    form.setValue("lastName", candidate.familyName, { shouldValidate: true });
    setStep("profile");
  };

  // If status changes away from member/supporting_alumni while on membership step, go back
  React.useEffect(() => {
    if (step === "membership" && !requiresMembershipStep) {
      setStep("profile");
    }
  }, [requiresMembershipStep, step]);

  // Clear paidThroughDate when leaving the membership path
  React.useEffect(() => {
    if (!requiresMembershipStep && form.getValues("paidThroughDate") !== "") {
      form.setValue("paidThroughDate", "");
    }
  }, [form, requiresMembershipStep]);

  // Reset when dialog closes
  React.useEffect(() => {
    if (open) return;
    setStep("browse");
    setSelected(null);
    setFirstNameUnlocked(false);
    setLastNameUnlocked(false);
    form.reset(defaultValues);
  }, [defaultValues, form, open]);

  const stepKeys: WizardStep[] = requiresMembershipStep
    ? ["browse", "profile", "membership"]
    : ["browse", "profile"];

  const stepLabels = requiresMembershipStep
    ? ["Browse", "Profile", "Membership"]
    : ["Browse", "Profile"];

  const activeStepIndex = Math.min(stepKeys.indexOf(step), stepKeys.length - 1);

  const handleProfileComplete = () => {
    if (requiresMembershipStep) {
      setStep("membership");
    } else {
      form.handleSubmit((data) => action.execute(data))();
    }
  };

  const handleMembershipComplete = () => {
    form.handleSubmit((data) => action.execute(data))();
  };

  const handleBack = () => {
    setStep(step === "membership" ? "profile" : "browse");
  };

  const rootError = form.formState.errors.root?.message;
  const isSubmitDisabled = !form.formState.isValid;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader className="gap-4">
          <div>
            <Breadcrumb>
              <BreadcrumbList>
                {stepLabels.map((label, index) => {
                  const isActive = index === activeStepIndex;
                  const isCompleted = index < activeStepIndex;

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
          </div>
          <div className="flex flex-col gap-2">
            <DialogTitle>Import from Google Workspace</DialogTitle>
            <DialogDescription>
              Link a Workspace account to START Cockpit without creating a new
              account.
            </DialogDescription>
          </div>
        </DialogHeader>

        <FormProvider {...form}>
          {step === "browse" ? (
            <BrowseStep
              open={open}
              selected={selected}
              onSelectUser={selectWorkspaceUser}
            />
          ) : (
            <div className="flex flex-col gap-y-4">
              {selected && (
                <div className="rounded-md bg-muted px-3 py-2 text-sm">
                  <span className="font-medium">{selected.name}</span>{" "}
                  <span className="text-muted-foreground">
                    {selected.primaryEmail}
                  </span>
                </div>
              )}

              {step === "profile" && (
                <ProfileStep
                  selected={selected}
                  firstNameUnlocked={firstNameUnlocked}
                  lastNameUnlocked={lastNameUnlocked}
                  onUnlockFirstName={() => setFirstNameUnlocked(true)}
                  onUnlockLastName={() => setLastNameUnlocked(true)}
                  batches={batches}
                  onComplete={handleProfileComplete}
                  onBack={handleBack}
                  submitLabel={requiresMembershipStep ? "Continue" : "Import"}
                  isSubmitDisabled={isSubmitDisabled}
                  isPending={action.isPending}
                  rootError={rootError}
                />
              )}

              {step === "membership" && (
                <MembershipStep
                  onComplete={handleMembershipComplete}
                  onBack={handleBack}
                  isSubmitDisabled={isSubmitDisabled}
                  isPending={action.isPending}
                  rootError={rootError}
                />
              )}
            </div>
          )}
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
