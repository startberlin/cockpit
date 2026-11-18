"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import { EllipsisIcon, EyeIcon, FilePenLineIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { useIsClient } from "usehooks-ts";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Form } from "@/components/ui/form";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  refreshCompaniesAction,
  saveJobAction,
  setJobStatusAction,
} from "../actions/mutations";
import { saveJobSchema } from "../actions/schemas";
import type { JobContent, PublicJob } from "../lib/contracts";
import { editorValidationMessage } from "../lib/editor-schemas";
import { ContextHelp } from "./context-help";
import { ExpiryDialog } from "./expiry-dialog";
import { FormError } from "./form-fields";
import type { JobEditorCompany } from "./job-editor-data";
import { JobEditorFields } from "./job-editor-fields";
import { JobPreviewPane } from "./job-preview-pane";
import { PublishDialog } from "./publish-dialog";
import { formatDate, StatusBadge } from "./status-badge";
import { UnsavedChangesGuard } from "./unsaved-changes-guard";

const defaultContent: JobContent = {
  title: "",
  description: "",
  employmentType: "full_time",
  seniority: "all",
  locations: [],
  countryCodes: [],
  remoteMode: "onsite",
  languages: ["English"],
  applyUrl: "",
  salaryStatus: "not_disclosed",
  salaryMin: null,
  salaryMax: null,
  salaryCurrency: "EUR",
  salaryPeriod: "year",
  weeklyHours: null,
  internshipDurationMonths: null,
};
export type EditableJob = {
  id: string;
  companyId: string;
  content: JobContent;
  notes: string;
  status: string;
  expiresAt: Date | string | null;
  published: PublicJob | null;
  publishedAt: Date | string | null;
  reviewToken: string;
  draftVersion: number;
};

export function JobForm({
  job,
  companies,
  canPublish,
}: {
  job?: EditableJob;
  companies: JobEditorCompany[];
  canPublish: boolean;
}) {
  const router = useRouter();
  const hydrated = useIsClient();
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const submitInFlight = useRef(false);
  const [pane, setPane] = useState("editor");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [companyOptions, setCompanyOptions] = useState(companies);
  const [companyNeedsReview, setCompanyNeedsReview] = useState(false);
  const [isRefreshing, startRefresh] = useTransition();
  const { form, action } = useHookFormAction(
    saveJobAction,
    zodResolver(saveJobSchema, { error: editorValidationMessage }),
    {
      formProps: {
        defaultValues: {
          id: job?.id,
          expectedDraftVersion: job?.draftVersion,
          companyId: job?.companyId ?? "",
          content: job?.content ?? defaultContent,
          notes: job?.notes ?? "",
        },
        shouldFocusError: false,
      },
      actionProps: {
        onSuccess: ({ data, input }) => {
          if (!data) return;
          form.reset({
            ...input,
            id: data.id,
            expectedDraftVersion: data.draftVersion,
          });
          setCompanyNeedsReview(false);
          toast.success("Draft saved.");
          if (!job)
            startRefresh(() =>
              router.replace(`/jobboard/jobs/${data.id}`, { scroll: false }),
            );
        },
        onError: ({ error }) => {
          setPane("editor");
          toast.error(error.serverError ?? "Review the highlighted fields.");
        },
      },
    },
  );
  const companyRefresh = useAction(refreshCompaniesAction, {
    onSuccess: ({ data }) => {
      if (!data) return;
      const selected = form.getValues("companyId");
      const before = companyOptions.find((company) => company.id === selected);
      const after = data.companies.find((company) => company.id === selected);
      if (job && JSON.stringify(before) !== JSON.stringify(after))
        setCompanyNeedsReview(true);
      setCompanyOptions(data.companies);
      toast.success("Companies refreshed.");
    },
    onError: ({ error }) =>
      toast.error(error.serverError ?? "Unable to refresh companies."),
  });
  const statusAction = useAction(setJobStatusAction, {
    onSuccess: () => {
      toast.success("Job status updated.");
    },
    onError: ({ error }) =>
      toast.error(error.serverError ?? "Unable to update this job."),
  });
  const busy =
    !hydrated ||
    action.isPending ||
    statusAction.isPending ||
    isRefreshing ||
    dialogOpen;
  const dirty = form.formState.isDirty;
  const showInvalidFields = useCallback(() => {
    setPane("editor");
    // Wait until the compact editor is visible before focusing an invalid control.
    requestAnimationFrame(() => {
      const field = formRef.current?.querySelector<HTMLElement>(
        "[aria-invalid='true']",
      );
      const section = field?.closest("details");
      if (section) section.open = true;
      field?.focus();
    });
  }, []);
  const submitDraft = useCallback(
    async (event?: React.BaseSyntheticEvent) => {
      event?.preventDefault();
      if (busy || submitInFlight.current) return;
      submitInFlight.current = true;
      try {
        await form.handleSubmit(async (values) => {
          await action.executeAsync(values);
        }, showInvalidFields)(event);
      } finally {
        submitInFlight.current = false;
      }
    },
    [busy, form, action.executeAsync, showInvalidFields],
  );
  useEffect(() => {
    const save = (event: KeyboardEvent) => {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.altKey ||
        event.key.toLowerCase() !== "s"
      )
        return;
      event.preventDefault();
      if (event.repeat) return;
      if (
        !busy &&
        companyOptions.length &&
        (dirty || companyNeedsReview || !job)
      )
        void submitDraft();
    };
    document.addEventListener("keydown", save);
    return () => document.removeEventListener("keydown", save);
  }, [
    busy,
    companyOptions.length,
    dirty,
    companyNeedsReview,
    job,
    submitDraft,
  ]);
  const errorMessage =
    action.result.serverError ?? statusAction.result.serverError;
  const hasErrors = Object.keys(form.formState.errors).length > 0;
  const canArchiveDraft =
    job?.status === "draft" &&
    job.publishedAt === null &&
    job.published === null;
  const saveLabel = action.isPending
    ? "Saving draft"
    : isRefreshing
      ? "Refreshing"
      : "Save draft";
  let stateLabel = "";
  if (errorMessage) stateLabel = "Not saved";
  else if (action.isPending) stateLabel = "Saving";
  else if (companyNeedsReview) stateLabel = "Company updated";
  else if (dirty) stateLabel = "Unsaved changes";
  else if (job) stateLabel = "Saved";
  return (
    <Form {...form}>
      <UnsavedChangesGuard dirty={dirty} />
      <noscript>Enable JavaScript to edit and save this form.</noscript>
      <div
        className="@container/workspace min-w-0 rounded-lg border bg-background"
        data-jobboard-editor
      >
        <header className="sticky top-0 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur-sm sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2.5">
              <StatusBadge status={job?.status ?? "draft"} />
              <span
                role="status"
                aria-live="polite"
                className={cn(
                  "text-xs text-muted-foreground",
                  errorMessage && "text-destructive",
                )}
              >
                {stateLabel}
              </span>
              <ContextHelp label="About saving drafts">
                Use Ctrl or Cmd + S to save draft changes.
                {canPublish &&
                  " Save the draft before publishing or changing its expiry."}
              </ContextHelp>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canPublish &&
              job?.status === "published" &&
              job.expiresAt &&
              job.published ? (
                <ExpiryDialog
                  id={job.id}
                  expiresAt={job.expiresAt}
                  publishedAt={job.published.publishedAt}
                  disabled={
                    busy ||
                    dirty ||
                    companyNeedsReview ||
                    companyRefresh.isPending
                  }
                  onOpenChange={setDialogOpen}
                >
                  Expires {formatDate(job.expiresAt, "UTC")}
                </ExpiryDialog>
              ) : job?.expiresAt ? (
                <span className="text-xs text-muted-foreground">
                  Expiry {formatDate(job.expiresAt, "UTC")}
                </span>
              ) : null}
              <Button
                type="submit"
                form={formId}
                variant={
                  job && !dirty && !companyNeedsReview ? "outline" : "default"
                }
                disabled={
                  busy ||
                  !companyOptions.length ||
                  (!!job && !dirty && !companyNeedsReview)
                }
              >
                {saveLabel}
              </Button>
              {canPublish && job ? (
                <PublishDialog
                  id={job.id}
                  reviewToken={job.reviewToken}
                  expiresAt={job.expiresAt}
                  published={job.status === "published"}
                  disabled={
                    busy ||
                    dirty ||
                    companyNeedsReview ||
                    companyRefresh.isPending
                  }
                  onOpenChange={setDialogOpen}
                />
              ) : null}
              {job &&
              job.status !== "closed" &&
              (canPublish || canArchiveDraft) ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="More listing actions"
                      disabled={busy || dirty}
                    >
                      <EllipsisIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {job.status === "published" ? (
                      <DropdownMenuItem
                        onSelect={() =>
                          statusAction.execute({ id: job.id, status: "paused" })
                        }
                      >
                        Pause listing
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem
                      onSelect={() =>
                        statusAction.execute({ id: job.id, status: "closed" })
                      }
                    >
                      {job.status === "draft"
                        ? "Archive draft"
                        : "Mark as closed"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          </div>
          {!canPublish && (
            <p className="mt-2 text-xs text-muted-foreground">
              Share the saved draft with a Partnerships lead or a Cockpit admin
              for publication.
            </p>
          )}
        </header>
        <div className="flex flex-col @min-[58rem]/workspace:h-[calc(100dvh-16rem)] @min-[58rem]/workspace:min-h-[30rem]">
          <div className="shrink-0 border-b px-3 py-2 @min-[58rem]/workspace:hidden">
            <ToggleGroup
              type="single"
              value={pane}
              onValueChange={(value) => {
                if (value) setPane(value);
              }}
              aria-label="Editor view"
              className="w-full"
            >
              <ToggleGroupItem
                value="editor"
                aria-controls="job-editor-inputs"
                className="min-h-11 flex-1"
              >
                <FilePenLineIcon className="size-4" />
                Edit
              </ToggleGroupItem>
              <ToggleGroupItem
                value="preview"
                aria-controls="job-editor-preview"
                className="min-h-11 flex-1"
              >
                <EyeIcon className="size-4" />
                Preview
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          {/* One form instance is retained when switching views or resizing. */}
          <div className="grid min-h-0 flex-1 grid-cols-1 @min-[58rem]/workspace:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div
              className={cn(
                "min-h-0 min-w-0",
                pane !== "editor" && "hidden @min-[58rem]/workspace:block",
              )}
            >
              <section
                id="job-editor-inputs"
                aria-label="Job details editor"
                className="@container/editor min-h-0 p-4 sm:p-6 @min-[58rem]/workspace:h-full @min-[58rem]/workspace:overflow-y-auto @min-[58rem]/workspace:overscroll-contain"
              >
                <div className="mx-auto max-w-3xl">
                  <form
                    method="post"
                    ref={formRef}
                    id={formId}
                    noValidate
                    onSubmit={submitDraft}
                    className="space-y-4"
                  >
                    <FormError message={errorMessage} />
                    {hasErrors ? (
                      <div
                        role="alert"
                        className="flex flex-wrap items-center justify-between gap-2 border border-destructive/30 bg-destructive/5 p-3 text-sm"
                      >
                        <p>Check the highlighted fields.</p>
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          onClick={showInvalidFields}
                        >
                          Go to first error
                        </Button>
                      </div>
                    ) : null}
                    <JobEditorFields
                      companies={companyOptions}
                      disabled={busy}
                      companyRefresh={{
                        run: () =>
                          companyRefresh.execute({
                            q: "",
                            selectedId:
                              form.getValues("companyId") || undefined,
                          }),
                        select: (company) =>
                          setCompanyOptions((current) =>
                            current.some((entry) => entry.id === company.id)
                              ? current
                              : [company, ...current],
                          ),
                        pending: companyRefresh.isPending,
                        error: companyRefresh.result.serverError,
                      }}
                    />
                  </form>
                </div>
              </section>
            </div>
            <div
              className={cn(
                "min-h-0 min-w-0 @min-[58rem]/workspace:border-l",
                pane !== "preview" && "hidden @min-[58rem]/workspace:block",
              )}
            >
              <div id="job-editor-preview" className="h-full min-h-0">
                <JobPreviewPane
                  companies={companyOptions}
                  published={job?.published ?? null}
                  isPublished={job?.status === "published"}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Form>
  );
}
