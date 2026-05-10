"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import { useQuery } from "@tanstack/react-query";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { AlertCircleIcon, CircleCheck, LockIcon, PencilIcon } from "lucide-react";
import * as React from "react";
import { Controller } from "react-hook-form";
import { useDebounce } from "use-debounce";
import { BatchSelect } from "@/components/batch-select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DEPARTMENTS } from "@/lib/enums";
import { USER_STATUS_INFO } from "@/lib/user-status";
import { cn, handleError } from "@/lib/utils";
import {
  fetchWorkspaceUsersPageAction,
  importGoogleWorkspaceUserAction,
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

type WizardStep = "browse" | "profile" | "membership";

type WorkspaceCandidate = NonNullable<
  Awaited<ReturnType<typeof fetchWorkspaceUsersPageAction>>["data"]
>["users"][number];

const EMPTY_CANDIDATES: WorkspaceCandidate[] = [];

const COLUMNS: ColumnDef<WorkspaceCandidate>[] = [
  {
    id: "name",
    accessorFn: (row) => row.name,
    header: "Name",
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    id: "email",
    accessorKey: "primaryEmail",
    header: "Email",
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => {
      const { suspended, linkedUser } = row.original;
      const disabled = !!linkedUser || suspended;
      return (
        <Badge variant={disabled ? "secondary" : "outline"}>
          {suspended ? "Suspended" : linkedUser ? "Linked" : "Importable"}
        </Badge>
      );
    },
  },
];

export function ImportGoogleUserDialog({
  open,
  onOpenChange,
  batches,
  onSuccess,
}: ImportGoogleUserDialogProps) {
  const [step, setStep] = React.useState<WizardStep>("browse");
  const [firstNameFilter, setFirstNameFilter] = React.useState("");
  const [lastNameFilter, setLastNameFilter] = React.useState("");
  const [debouncedFirstName] = useDebounce(firstNameFilter, 300);
  const [debouncedLastName] = useDebounce(lastNameFilter, 300);
  // Stack of pageTokens: index 0 is page 1 (token = undefined), subsequent entries are GWS nextPageTokens.
  const [pageTokens, setPageTokens] = React.useState<(string | undefined)[]>([
    undefined,
  ]);
  const [pageIndex, setPageIndex] = React.useState(0);
  const [selected, setSelected] = React.useState<WorkspaceCandidate | null>(
    null,
  );
  const [firstNameUnlocked, setFirstNameUnlocked] = React.useState(false);
  const [lastNameUnlocked, setLastNameUnlocked] = React.useState(false);

  const gwsQuery =
    [
      debouncedFirstName && `givenName:${debouncedFirstName}`,
      debouncedLastName && `familyName:${debouncedLastName}`,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  const currentPageToken = pageTokens[pageIndex];

  const {
    data: pageData,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["workspace-users", currentPageToken, gwsQuery],
    queryFn: async () => {
      const result = await fetchWorkspaceUsersPageAction({
        pageToken: currentPageToken,
        query: gwsQuery,
      });
      if (!result?.data) throw new Error("Failed to load Workspace users.");
      return result.data;
    },
    enabled: open,
    staleTime: 30_000,
  });

  const candidates = pageData?.users ?? EMPTY_CANDIDATES;
  const nextPageToken = pageData?.nextPageToken ?? null;
  const isLoading = isFetching;
  const loadError = isError;

  React.useEffect(() => {
    if (nextPageToken && pageTokens.length <= pageIndex + 1) {
      setPageTokens((prev) => [...prev, nextPageToken]);
    }
  }, [nextPageToken, pageIndex, pageTokens.length]);

  const table = useReactTable({
    data: candidates,
    columns: COLUMNS,
    getCoreRowModel: getCoreRowModel(),
  });

  const defaultValues = React.useMemo(
    () => ({
      googleWorkspaceUserId: "",
      firstName: "",
      lastName: "",
      batchNumber: undefined,
      status: "member" as const,
      paidThroughAt: "",
      documentsVerified: false,
    }),
    [],
  );
  const resolver = React.useMemo(
    () => zodResolver(importGoogleWorkspaceUserSchema),
    [],
  );
  const { form, handleSubmitWithAction, action } = useHookFormAction(
    importGoogleWorkspaceUserAction,
    resolver,
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

  const selectedStatus = form.watch("status");
  const shouldShowDepartment = selectedStatus === "member";
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

  React.useEffect(() => {
    if (!shouldShowDepartment && form.getValues("department") !== null) {
      form.setValue("department", null);
    }
    if (!requiresMembershipStep) {
      if (form.getValues("paidThroughAt") !== "") {
        form.setValue("paidThroughAt", "");
      }
      if (form.getValues("documentsVerified") !== undefined) {
        form.setValue("documentsVerified", undefined);
      }
    } else if (form.getValues("documentsVerified") === undefined) {
      form.setValue("documentsVerified", false);
    }
  }, [form, shouldShowDepartment, requiresMembershipStep]);

  React.useEffect(() => {
    if (step === "membership" && !requiresMembershipStep) {
      setStep("profile");
    }
  }, [requiresMembershipStep, step]);

  React.useEffect(() => {
    if (open) return;

    setStep("browse");
    setFirstNameFilter("");
    setLastNameFilter("");
    setPageTokens([undefined]);
    setPageIndex(0);
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

  const rows = table.getRowModel().rows;
  const hasPreviousPage = pageIndex > 0;
  const hasNextPage = !!nextPageToken;

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
                          "rounded-md px-[6px] py-[2px]",
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

        {step === "browse" ? (
          <div className="space-y-4">
            <div className="flex gap-3">
              <Field className="flex-1">
                <FieldLabel htmlFor="filterFirstName">First name</FieldLabel>
                <Input
                  id="filterFirstName"
                  value={firstNameFilter}
                  placeholder="Filter by first name"
                  onChange={(e) => {
                    setFirstNameFilter(e.target.value);
                    setPageTokens([undefined]);
                    setPageIndex(0);
                  }}
                />
              </Field>
              <Field className="flex-1">
                <FieldLabel htmlFor="filterLastName">Last name</FieldLabel>
                <Input
                  id="filterLastName"
                  value={lastNameFilter}
                  placeholder="Filter by last name"
                  onChange={(e) => {
                    setLastNameFilter(e.target.value);
                    setPageTokens([undefined]);
                    setPageIndex(0);
                  }}
                />
              </Field>
            </div>

            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Skeleton className="h-4 w-32" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-48" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-20" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : loadError ? null : rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="py-8 text-center text-muted-foreground text-sm"
                      >
                        {candidates.length === 0
                          ? "No Workspace users found."
                          : "No users match these filters."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => {
                      const candidate = row.original;
                      const disabled =
                        !!candidate.linkedUser || candidate.suspended;
                      const isSelected = selected?.id === candidate.id;
                      return (
                        <TableRow
                          key={candidate.id}
                          className={cn(
                            disabled ? "opacity-60" : "cursor-pointer",
                            isSelected && "bg-muted/50",
                          )}
                          onClick={() => selectWorkspaceUser(candidate)}
                        >
                          <TableCell>
                            <span className="font-medium">
                              {candidate.name}
                            </span>
                          </TableCell>
                          <TableCell>{candidate.primaryEmail}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                disabled
                                  ? "secondary"
                                  : isSelected
                                    ? "default"
                                    : "outline"
                              }
                            >
                              {candidate.suspended
                                ? "Suspended"
                                : candidate.linkedUser
                                  ? "Linked"
                                  : isSelected
                                    ? "Selected"
                                    : "Importable"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {loadError && (
              <Alert variant="destructive">
                <AlertCircleIcon className="h-4 w-4" />
                <AlertTitle>Failed to load Workspace users</AlertTitle>
                <AlertDescription className="flex items-center gap-2">
                  <span>Could not connect to Google Workspace.</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isLoading}
                    onClick={() => refetch()}
                  >
                    {isLoading ? "Retrying…" : "Retry"}
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {!loadError && (hasPreviousPage || hasNextPage) && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Page {pageIndex + 1}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!hasPreviousPage || isLoading}
                    onClick={() => setPageIndex((i) => i - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!hasNextPage || isLoading}
                    onClick={() => setPageIndex((i) => i + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

          </div>
        ) : (
          <form
            className="flex flex-col gap-y-6"
            onSubmit={(e) => {
              const isLastStep =
                !requiresMembershipStep || step === "membership";
              if (!isLastStep) {
                e.preventDefault();
                return;
              }
              return handleSubmitWithAction(e);
            }}
          >
            {selected && (
              <div className="rounded-md bg-muted px-3 py-2 text-sm">
                <span className="font-medium">{selected.name}</span>{" "}
                <span className="text-muted-foreground">
                  {selected.primaryEmail}
                </span>
              </div>
            )}

            {step === "profile" && (
              <>
                <FieldSet>
                  <FieldLegend>START Cockpit profile</FieldLegend>
                  <FieldGroup>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field className="min-w-0">
                        <FieldLabel htmlFor="importFirstName">
                          First name
                        </FieldLabel>
                        <InputGroup>
                          <InputGroupInput
                            id="importFirstName"
                            disabled={!firstNameUnlocked}
                            aria-invalid={!!form.formState.errors.firstName}
                            {...form.register("firstName")}
                          />
                          {!firstNameUnlocked && (
                            <InputGroupAddon align="inline-end">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <InputGroupButton
                                    className="rounded-full"
                                    size="icon-xs"
                                    aria-label="Edit first name"
                                    onClick={() => setFirstNameUnlocked(true)}
                                  >
                                    <PencilIcon />
                                  </InputGroupButton>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Edit first name.
                                </TooltipContent>
                              </Tooltip>
                            </InputGroupAddon>
                          )}
                        </InputGroup>
                        <FieldError
                          errors={[form.formState.errors.firstName]}
                        />
                      </Field>
                      <Field className="min-w-0">
                        <FieldLabel htmlFor="importLastName">
                          Last name
                        </FieldLabel>
                        <InputGroup>
                          <InputGroupInput
                            id="importLastName"
                            disabled={!lastNameUnlocked}
                            aria-invalid={!!form.formState.errors.lastName}
                            {...form.register("lastName")}
                          />
                          {!lastNameUnlocked && (
                            <InputGroupAddon align="inline-end">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <InputGroupButton
                                    className="rounded-full"
                                    size="icon-xs"
                                    aria-label="Edit last name"
                                    onClick={() => setLastNameUnlocked(true)}
                                  >
                                    <PencilIcon />
                                  </InputGroupButton>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Edit last name.
                                </TooltipContent>
                              </Tooltip>
                            </InputGroupAddon>
                          )}
                        </InputGroup>
                        <FieldError errors={[form.formState.errors.lastName]} />
                      </Field>
                    </div>
                    <Field>
                      <FieldLabel htmlFor="importEmail">Email</FieldLabel>
                      <InputGroup>
                        <InputGroupInput
                          id="importEmail"
                          value={selected?.primaryEmail ?? ""}
                          disabled
                          className="w-full"
                        />
                        <InputGroupAddon align="inline-end">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <InputGroupButton
                                className="rounded-full"
                                size="icon-xs"
                                aria-label="Email locked"
                              >
                                <LockIcon />
                              </InputGroupButton>
                            </TooltipTrigger>
                            <TooltipContent>
                              Workspace email cannot be changed during import.
                            </TooltipContent>
                          </Tooltip>
                        </InputGroupAddon>
                      </InputGroup>
                    </Field>
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
                          <BatchSelect
                            batches={batches}
                            value={field.value}
                            onChange={field.onChange}
                          />
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
                                {Object.entries(DEPARTMENTS).map(
                                  ([id, name]) => (
                                    <SelectItem key={id} value={id}>
                                      {name}
                                    </SelectItem>
                                  ),
                                )}
                              </SelectContent>
                            </Select>
                            <FieldError errors={[fieldState.error]} />
                          </Field>
                        )}
                      />
                    )}
                  </FieldGroup>
                </FieldSet>
              </>
            )}

            {step === "membership" && (
              <>
                <FieldSet>
                  <FieldLegend>Membership</FieldLegend>
                  <FieldDescription>
                    If this person has already paid for their active membership
                    period, enter the date their membership is covered through.
                    START Cockpit will schedule the first yearly membership
                    payment after this date.
                  </FieldDescription>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="paidThroughAt">
                        Paid through
                      </FieldLabel>
                      <Input
                        id="paidThroughAt"
                        type="date"
                        aria-invalid={!!form.formState.errors.paidThroughAt}
                        {...form.register("paidThroughAt")}
                      />
                      <FieldDescription>
                        Leave empty if the member should set up payment right
                        after import.
                      </FieldDescription>
                      <FieldError
                        errors={[form.formState.errors.paidThroughAt]}
                      />
                    </Field>
                  </FieldGroup>
                </FieldSet>

                <FieldSet>
                  <FieldLegend>Documents</FieldLegend>
                  <FieldDescription>
                    Check this if you've received and verified the person's
                    membership documents. Leave unchecked if documents are
                    missing or you're unsure — the board will be asked to vote
                    on formal admission.
                  </FieldDescription>
                  <FieldGroup>
                    <Controller
                      name="documentsVerified"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="documentsVerified"
                              checked={field.value ?? false}
                              onCheckedChange={(checked) =>
                                field.onChange(checked === true)
                              }
                            />
                            <FieldLabel htmlFor="documentsVerified">
                              Documents verified
                            </FieldLabel>
                          </div>
                          <FieldError errors={[fieldState.error]} />
                        </Field>
                      )}
                    />
                  </FieldGroup>
                </FieldSet>
              </>
            )}

            {form.formState.errors.root && (
              <Alert className="text-destructive text-sm" variant="destructive">
                <AlertCircleIcon className="h-4 w-4" />
                <AlertTitle>Could not import member</AlertTitle>
                <AlertDescription>
                  <p>{form.formState.errors.root.message}</p>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setStep(step === "membership" ? "profile" : "browse")
                }
              >
                Back
              </Button>
              {step === "profile" && requiresMembershipStep ? (
                <Button
                  type="button"
                  disabled={!form.formState.isValid}
                  onClick={() => setStep("membership")}
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={!form.formState.isValid || action.isPending}
                >
                  {action.isPending ? "Importing..." : "Import"}
                </Button>
              )}
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
