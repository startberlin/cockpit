"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import { AlertCircleIcon, Search } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import * as React from "react";
import { Controller } from "react-hook-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEPARTMENTS } from "@/lib/enums";
import { USER_STATUS_INFO } from "@/lib/user-status";
import { handleError } from "@/lib/utils";
import {
  importGoogleWorkspaceUserAction,
  searchGoogleWorkspaceUsersAction,
} from "./import-google-user-action";
import {
  importableUserStatus,
  importGoogleWorkspaceUserSchema,
} from "./import-google-user-schema";

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
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<{
    id: string;
    name: string;
    primaryEmail: string;
  } | null>(null);
  const search = useAction(searchGoogleWorkspaceUsersAction, {
    onError: handleError,
  });
  const { form, handleSubmitWithAction, action } = useHookFormAction(
    importGoogleWorkspaceUserAction,
    zodResolver(importGoogleWorkspaceUserSchema),
    {
      actionProps: {
        onSuccess: () => {
          onOpenChange(false);
          onSuccess?.();
        },
        onError: handleError,
      },
      formProps: {
        defaultValues: {
          googleWorkspaceUserId: "",
          firstName: "",
          lastName: "",
          batchNumber: batches[0]?.number ?? 0,
          status: "member",
          paidThroughAt: "",
        },
        mode: "onChange",
      },
    },
  );

  const results = search.result.data ?? [];
  const isSearching = search.status === "executing";
  const selectedStatus = form.watch("status");
  const shouldShowDepartment = selectedStatus === "member";
  const shouldShowMembershipTiming = selectedStatus !== "alumni";

  const runSearch = () => {
    if (query.trim().length < 2) {
      return;
    }

    search.execute({ query });
  };

  React.useEffect(() => {
    if (!shouldShowDepartment) {
      form.setValue("department", null, { shouldValidate: true });
    }

    if (!shouldShowMembershipTiming) {
      form.setValue("paidThroughAt", "", { shouldValidate: true });
    }
  }, [form, shouldShowDepartment, shouldShowMembershipTiming]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Google user</DialogTitle>
          <DialogDescription>
            Add someone who already has a Google Workspace account to START
            Cockpit without creating a new Google account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field>
            <FieldLabel htmlFor="workspaceSearch">
              Search Google Workspace
            </FieldLabel>
            <div className="flex gap-2">
              <Input
                id="workspaceSearch"
                value={query}
                placeholder="Name or Workspace email"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    runSearch();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={query.trim().length < 2 || isSearching}
                onClick={runSearch}
              >
                <Search />
                {isSearching ? "Searching" : "Search"}
              </Button>
            </div>
            <FieldDescription>
              Select one unlinked Google Workspace user to import.
            </FieldDescription>
          </Field>

          {results.length > 0 && (
            <div className="space-y-2">
              {results.map((result) => {
                const disabled = !!result.linkedUser || result.suspended;
                return (
                  <button
                    key={result.id}
                    type="button"
                    disabled={disabled}
                    className="flex w-full items-center justify-between gap-3 rounded-md border p-3 text-left text-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => {
                      setSelected(result);
                      form.setValue("googleWorkspaceUserId", result.id, {
                        shouldValidate: true,
                      });
                      form.setValue("firstName", result.givenName, {
                        shouldValidate: true,
                      });
                      form.setValue("lastName", result.familyName, {
                        shouldValidate: true,
                      });
                    }}
                  >
                    <span>
                      <span className="block font-medium">{result.name}</span>
                      <span className="block text-muted-foreground">
                        {result.primaryEmail}
                      </span>
                      {result.linkedUser && (
                        <span className="block text-muted-foreground">
                          Already linked to {result.linkedUser.name}
                        </span>
                      )}
                    </span>
                    <Badge variant={disabled ? "secondary" : "outline"}>
                      {result.suspended
                        ? "Suspended"
                        : result.linkedUser
                          ? "Linked"
                          : "Importable"}
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <form
          className="flex flex-col gap-y-6"
          onSubmit={handleSubmitWithAction}
        >
          {selected && (
            <Alert>
              <AlertTitle>Selected Google Workspace user</AlertTitle>
              <AlertDescription>
                {selected.name} ({selected.primaryEmail}) will be used to create
                the START Cockpit user.
              </AlertDescription>
            </Alert>
          )}

          <FieldSet>
            <FieldLegend>Local profile</FieldLegend>
            <FieldGroup>
              <div className="flex gap-4">
                <Field className="flex-1">
                  <FieldLabel htmlFor="importFirstName">First name</FieldLabel>
                  <Input
                    id="importFirstName"
                    readOnly={!!selected}
                    aria-invalid={!!form.formState.errors.firstName}
                    {...form.register("firstName")}
                  />
                  <FieldError errors={[form.formState.errors.firstName]} />
                </Field>
                <Field className="flex-1">
                  <FieldLabel htmlFor="importLastName">Last name</FieldLabel>
                  <Input
                    id="importLastName"
                    readOnly={!!selected}
                    aria-invalid={!!form.formState.errors.lastName}
                    {...form.register("lastName")}
                  />
                  <FieldError errors={[form.formState.errors.lastName]} />
                </Field>
              </div>
            </FieldGroup>
          </FieldSet>

          <FieldSet>
            <FieldLegend>Organization</FieldLegend>
            <FieldGroup>
              <Controller
                name="batchNumber"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Batch</FieldLabel>
                    <Select
                      value={String(field.value ?? "")}
                      onValueChange={(v) => field.onChange(Number(v))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a batch" />
                      </SelectTrigger>
                      <SelectContent>
                        {batches.map((b) => (
                          <SelectItem key={b.number} value={String(b.number)}>
                            Batch {b.number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />

              <Controller
                name="status"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Status</FieldLabel>
                    <Select
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a status" />
                      </SelectTrigger>
                      <SelectContent>
                        {importableUserStatus.options.map((status) => (
                          <SelectItem key={status} value={status}>
                            {USER_STATUS_INFO[status].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />

              {shouldShowDepartment && (
                <Controller
                  name="department"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel>Department</FieldLabel>
                      <Select
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a department" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(DEPARTMENTS).map(([id, name]) => (
                            <SelectItem key={id} value={id}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
              )}
            </FieldGroup>
          </FieldSet>

          {shouldShowMembershipTiming && (
            <FieldSet>
              <FieldLegend>Membership</FieldLegend>
              <FieldDescription>
                If this person has already paid for their active membership
                period, enter the date their membership is covered through.
                START Cockpit will schedule the first yearly charge after this
                date.
              </FieldDescription>
              <Field>
                <FieldLabel htmlFor="paidThroughAt">Paid through</FieldLabel>
                <Input
                  id="paidThroughAt"
                  type="date"
                  aria-invalid={!!form.formState.errors.paidThroughAt}
                  {...form.register("paidThroughAt")}
                />
                <FieldDescription>
                  Leave empty if the member should be billed immediately after
                  onboarding.
                </FieldDescription>
                <FieldError errors={[form.formState.errors.paidThroughAt]} />
              </Field>
            </FieldSet>
          )}

          {form.formState.errors.root && (
            <Alert className="text-destructive text-sm" variant="destructive">
              <AlertCircleIcon className="h-4 w-4" />
              <AlertTitle>Could not import user</AlertTitle>
              <AlertDescription>
                <p>{form.formState.errors.root.message}</p>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="submit"
              disabled={!form.formState.isValid || action.isPending}
            >
              {action.isPending ? "Importing..." : "Import user"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
