"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDownIcon,
  ClipboardCheckIcon,
  InboxIcon,
  LockKeyholeIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSerializer, debounce, useQueryStates } from "nuqs";
import { useCallback, useId, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  acceptSubmissionAction,
  loadSubmissionReviewAction,
  rejectSubmissionAction,
} from "../actions/mutations";
import {
  acceptSubmissionSchema,
  rejectSubmissionSchema,
} from "../actions/schemas";
import {
  MANAGEMENT_PAGE_SIZE,
  type ListPagination as Pagination,
  submissionListParams,
} from "../lib/list-params";
import { CompanyForm } from "./company-form";
import { FormError, SelectField, TextField } from "./form-fields";
import { JobPreview } from "./job-preview";
import { ListPagination } from "./list-pagination";
import { EmptyState } from "./page-header";
import { formatDate, StatusBadge } from "./status-badge";
import { useCompanySearch } from "./use-company-search";

const listUrl = createSerializer(submissionListParams);

type SubmissionSummary = {
  id: string;
  title: string;
  companyName: string;
  status: string;
  createdAt: Date;
};
type Review = NonNullable<
  NonNullable<Awaited<ReturnType<typeof loadSubmissionReviewAction>>>["data"]
>;
type CompanyChoice = { id: string; name: string };

function SubmissionDetails({
  submission,
  companies,
  possibleCompanies,
  duplicateJobs,
}: Review) {
  const router = useRouter();
  const searchId = useId();
  const [createCompany, setCreateCompany] = useState(false);
  const [discardCompany, setDiscardCompany] = useState(false);
  const [companyFormState, setCompanyFormState] = useState({
    dirty: false,
    pending: false,
  });
  const [rejectOpen, setRejectOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CompanyChoice | null>(
    null,
  );
  const search = useCompanySearch(companies, true);
  const choices = [
    ...new Map(
      [
        ...possibleCompanies,
        ...(selectedCompany ? [selectedCompany] : []),
        ...search.rows,
      ].map((company) => [company.id, company]),
    ).values(),
  ];
  const accept = useHookFormAction(
    acceptSubmissionAction,
    zodResolver(acceptSubmissionSchema),
    {
      formProps: { defaultValues: { id: submission.id, companyId: "" } },
      actionProps: {
        onSuccess: ({ data }) => {
          if (!data) return;
          toast.success("Submission accepted as a draft.");
          router.push(`/jobboard/jobs/${data.id}`);
        },
        onError: ({ error }) =>
          toast.error(
            error.serverError ?? "Select a company before accepting.",
          ),
      },
    },
  );
  const reject = useHookFormAction(
    rejectSubmissionAction,
    zodResolver(rejectSubmissionSchema),
    {
      formProps: { defaultValues: { id: submission.id, note: "" } },
      actionProps: {
        onSuccess: () => {
          setRejectOpen(false);
          toast.success("Submission rejected.");
        },
        onError: ({ error }) =>
          toast.error(error.serverError ?? "Add a rejection reason."),
      },
    },
  );
  return (
    <div className="space-y-6 border-t p-4 sm:p-6">
      <JobPreview
        content={submission.payload.job}
        company={submission.payload.company.name}
        companyDescription={submission.payload.company.description}
        companyWebsite={submission.payload.company.website}
      />
      <div className="space-y-2 rounded-md border bg-muted/30 p-4 text-sm">
        <h3 className="inline-flex items-center gap-2 font-medium">
          <LockKeyholeIcon
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />{" "}
          Submitted contact
        </h3>
        <p>
          {submission.payload.contact.name}
          {submission.payload.contact.role
            ? ` · ${submission.payload.contact.role}`
            : ""}
        </p>
        <p className="break-all">
          <a
            href={`mailto:${submission.payload.contact.email}`}
            className="underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
          >
            {submission.payload.contact.email}
          </a>
        </p>
        {submission.payload.contact.phone ? (
          <p>{submission.payload.contact.phone}</p>
        ) : null}
        {submission.payload.contact.notes ? (
          <p className="whitespace-pre-wrap break-words">
            {submission.payload.contact.notes}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Publishing permission confirmed.
        </p>
      </div>
      {duplicateJobs.length ? (
        <div className="space-y-2 rounded-md border border-brand-accent/30 bg-brand-accent/10 p-4 text-sm text-brand">
          <h3 className="font-medium">Possible duplicate jobs</h3>
          <ul className="space-y-1">
            {duplicateJobs.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/jobboard/jobs/${job.id}`}
                  className="underline underline-offset-4"
                >
                  {job.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {submission.status === "pending_review" ? (
        <div className="space-y-4 border-t pt-5">
          {possibleCompanies.length ? (
            <p className="text-sm text-muted-foreground">
              Possible company match:{" "}
              {possibleCompanies.map((company) => company.name).join(", ")}.
              Confirm the correct company below.
            </p>
          ) : null}
          <Form {...accept.form}>
            <form
              method="post"
              onSubmit={accept.handleSubmitWithAction}
              className="space-y-4"
            >
              {companies.length >= MANAGEMENT_PAGE_SIZE ? (
                <div className="space-y-2">
                  <Label htmlFor={searchId}>Find company</Label>
                  <Input
                    id={searchId}
                    type="search"
                    value={search.q}
                    maxLength={300}
                    onChange={(event) => search.setQ(event.target.value)}
                    placeholder="Company name"
                  />
                  {search.message ? (
                    <p role="status" className="text-xs text-muted-foreground">
                      {search.message}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <SelectField
                onValueChange={(id) =>
                  setSelectedCompany(
                    choices.find((company) => company.id === id) ?? null,
                  )
                }
                name="companyId"
                label="Company"
                required
                disabled={accept.action.isPending || reject.action.isPending}
                options={[
                  { value: "", label: "Select company" },
                  ...choices.map((company) => ({
                    value: company.id,
                    label: company.name,
                  })),
                ]}
                help="Creates a draft using this company. Existing company details and contacts are preserved."
              />
              <FormError message={accept.action.result.serverError} />
              <div className="flex flex-wrap gap-2 [&_button]:min-h-11">
                <Button
                  type="submit"
                  disabled={accept.action.isPending || reject.action.isPending}
                >
                  {accept.action.isPending
                    ? "Creating draft"
                    : "Accept as draft"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateCompany(true)}
                  disabled={accept.action.isPending}
                >
                  Create a new company
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setRejectOpen(true)}
                  disabled={accept.action.isPending}
                >
                  Reject submission
                </Button>
              </div>
            </form>
          </Form>
          <Dialog
            open={createCompany}
            onOpenChange={(open) => {
              if (companyFormState.pending) return;
              if (!open && companyFormState.dirty) setDiscardCompany(true);
              else setCreateCompany(open);
            }}
          >
            <DialogContent
              showCloseButton={!companyFormState.pending}
              className="max-h-[90dvh] overflow-y-auto overscroll-contain sm:max-w-2xl"
            >
              <DialogHeader>
                <DialogTitle>Create company from submission</DialogTitle>
                <DialogDescription>
                  Review the submitted details. Saving creates a new company and
                  selects it for this submission.
                </DialogDescription>
              </DialogHeader>
              <CompanyForm
                onStateChange={setCompanyFormState}
                company={{
                  ...submission.payload.company,
                  contacts: [submission.payload.contact],
                  notes: `Created from submission ${submission.id}.`,
                  terms: "",
                }}
                onSaved={(id, savedCompany) => {
                  setSelectedCompany({
                    id,
                    name: savedCompany.name,
                  });
                  accept.form.setValue("companyId", id, {
                    shouldValidate: true,
                  });
                  setCreateCompany(false);
                }}
              />
            </DialogContent>
          </Dialog>
          <AlertDialog open={discardCompany} onOpenChange={setDiscardCompany}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Discard company changes?</AlertDialogTitle>
                <AlertDialogDescription>
                  Your unsaved company profile and contact edits will be
                  removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep editing</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => setCreateCompany(false)}
                >
                  Discard changes
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Dialog
            open={rejectOpen}
            onOpenChange={(open) => {
              if (!reject.action.isPending) setRejectOpen(open);
            }}
          >
            <DialogContent showCloseButton={!reject.action.isPending}>
              <DialogHeader>
                <DialogTitle>Reject submission</DialogTitle>
                <DialogDescription>
                  Record why this opportunity will not become a job draft. This
                  does not send an email to the employer.
                </DialogDescription>
              </DialogHeader>
              <Form {...reject.form}>
                <form
                  method="post"
                  onSubmit={reject.handleSubmitWithAction}
                  className="space-y-4"
                >
                  <TextField
                    name="note"
                    disabled={reject.action.isPending}
                    label="Reason"
                    multiline
                    required
                    maxLength={2000}
                  />
                  <FormError message={reject.action.result.serverError} />
                  <div className="flex flex-wrap justify-end gap-2 [&_button]:min-h-11">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setRejectOpen(false)}
                      disabled={reject.action.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="destructive"
                      disabled={reject.action.isPending}
                    >
                      {reject.action.isPending
                        ? "Rejecting"
                        : "Reject submission"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <div className="space-y-2 border-t pt-4 text-sm">
          {submission.jobId ? (
            <Link
              href={`/jobboard/jobs/${submission.jobId}`}
              className="underline underline-offset-4"
            >
              Open job created from this submission
            </Link>
          ) : null}
          {submission.reviewNote ? (
            <p className="whitespace-pre-wrap break-words text-muted-foreground">
              Review note: {submission.reviewNote}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function SubmissionReview({ summary }: { summary: SubmissionSummary }) {
  const [expanded, setExpanded] = useState(false);
  // A native summary can be opened from the server-rendered page before React attaches.
  const readInitialDisclosure = useCallback(
    (element: HTMLDetailsElement | null) => {
      if (element) setExpanded(element.open);
    },
    [],
  );
  const review = useQuery({
    queryKey: ["jobboard", "submission", summary.id, summary.status],
    enabled: expanded,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const result = await loadSubmissionReviewAction({ id: summary.id });
      if (!result?.data) throw new Error("Could not load this submission.");
      return result.data;
    },
  });
  return (
    <details
      ref={readInitialDisclosure}
      suppressHydrationWarning
      className="group min-w-0 rounded-xl border bg-card shadow-xs"
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary className="cursor-pointer list-none space-y-2 p-4 transition-colors hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring sm:p-5 [&::-webkit-details-marker]:hidden">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <h3 className="break-words text-sm font-semibold leading-relaxed">
              {summary.title}
            </h3>
            <p className="break-words text-sm text-muted-foreground">
              {summary.companyName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={summary.status} />
            <ChevronDownIcon
              className="size-4 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Received {formatDate(summary.createdAt)}
        </p>
      </summary>
      {expanded ? (
        review.data ? (
          <SubmissionDetails {...review.data} />
        ) : (
          <div className="space-y-2 border-t p-4">
            <p role="status">
              {review.isError
                ? "Could not load this submission."
                : "Loading submission"}
            </p>
            {review.isError ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void review.refetch()}
              >
                Try again
              </Button>
            ) : null}
          </div>
        )
      ) : null}
    </details>
  );
}
export function SubmissionList({
  rows,
  counts,
  total,
  ...pagination
}: Pagination & {
  rows: SubmissionSummary[];
  counts: Record<string, number>;
  total: number;
}) {
  const [{ status, q }, setFilters] = useQueryStates(submissionListParams, {
    shallow: false,
  });
  const query = q.trim();
  const options = [
    { value: "pending_review", label: "Needs review" },
    { value: "accepted", label: "Draft created" },
    { value: "rejected", label: "Rejected" },
    { value: "all", label: "All" },
  ] as const;
  const pending = rows.filter((row) => row.status === "pending_review");
  const reviewed = rows.filter((row) => row.status !== "pending_review");
  const reviewedCount = total - (counts.pending_review ?? 0);
  return (
    <div className="min-w-0 space-y-5">
      <div className="space-y-4 rounded-xl border bg-card p-4">
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Review status"
        >
          {options.map((option) => {
            const count =
              option.value === "all" ? total : (counts[option.value] ?? 0);
            return (
              <Button
                key={option.value}
                variant={status === option.value ? "default" : "outline"}
                className="min-h-11 gap-2"
                aria-pressed={status === option.value}
                onClick={() =>
                  void setFilters({ page: null, status: option.value })
                }
              >
                {option.label}
                <span className="opacity-70 tabular-nums">{count}</span>
              </Button>
            );
          })}
        </div>
        <div className="max-w-lg space-y-2">
          <Label htmlFor="submission-search">Find a submission</Label>
          <div className="relative">
            <SearchIcon
              className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="submission-search"
              type="search"
              autoComplete="off"
              className="h-11 pl-9"
              value={q}
              onChange={(event) =>
                void setFilters(
                  { page: null, q: event.target.value },
                  { limitUrlUpdates: debounce(250) },
                )
              }
              placeholder="Job, company or contact"
            />
          </div>
        </div>
      </div>
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {pagination.matched}{" "}
          {pagination.matched === 1 ? "submission" : "submissions"}
          {status === "pending_review" && !query
            ? " awaiting a decision"
            : " in this view"}
        </p>
        {q ? (
          <Button
            variant="ghost"
            size="sm"
            className="min-h-9"
            onClick={() => void setFilters({ page: null, q: null })}
          >
            <XIcon aria-hidden="true" /> Clear search
          </Button>
        ) : null}
      </div>
      {rows.length ? (
        [
          {
            title: "Needs review",
            rows: pending,
            icon: InboxIcon,
            description:
              "Oldest submissions first. Accepting creates a draft for final review.",
          },
          {
            title: "Reviewed submissions",
            rows: reviewed,
            icon: ClipboardCheckIcon,
            description:
              "Keep the original details and review decisions together.",
          },
        ]
          .filter((group) => group.rows.length)
          .map((group) => (
            <section key={group.title} className="space-y-3">
              <div className="space-y-1">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <group.icon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  {group.title}
                </h2>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {group.description}
                </p>
              </div>
              {group.rows.map((submission) => (
                <SubmissionReview key={submission.id} summary={submission} />
              ))}
            </section>
          ))
      ) : (
        <EmptyState
          title={
            query
              ? "No matching submissions"
              : status === "pending_review"
                ? "The review queue is clear"
                : "No submissions in this view"
          }
          description={
            query
              ? "Try another job, company name or contact."
              : status === "pending_review"
                ? "New employer submissions will appear here for review. Nothing is published automatically."
                : "Choose another review status to see earlier submissions."
          }
          icon={
            status === "pending_review" && !query ? (
              <ClipboardCheckIcon aria-hidden="true" />
            ) : (
              <SearchIcon aria-hidden="true" />
            )
          }
        >
          {q ? (
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => void setFilters({ page: null, q: null })}
            >
              Clear search
            </Button>
          ) : reviewedCount && status === "pending_review" ? (
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => void setFilters({ page: null, status: "all" })}
            >
              View reviewed submissions
            </Button>
          ) : status !== "pending_review" ? (
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() =>
                void setFilters({ page: null, status: "pending_review" })
              }
            >
              Back to review queue
            </Button>
          ) : null}
        </EmptyState>
      )}
      <ListPagination
        {...pagination}
        hrefForPage={(page) =>
          listUrl("/jobboard/submissions", { page, q, status })
        }
      />
    </div>
  );
}
