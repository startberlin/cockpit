import {
  ArrowUpRightIcon,
  BriefcaseBusinessIcon,
  MapPinIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { isSafePublicUrl, type JobContent } from "../lib/contracts";
import {
  employmentLabels,
  formatCompensation,
  remoteLabels,
  seniorityLabels,
} from "./job-editor-data";

export function JobPreview({
  content,
  company,
  companyDescription,
  companyWebsite,
}: {
  content: JobContent;
  company: string;
  companyDescription?: string;
  companyWebsite?: string;
}) {
  const hasApplication = isSafePublicUrl(content.applyUrl);
  return (
    <article className="@container/job-preview min-w-0 space-y-6 wrap-anywhere">
      <header className="space-y-4 border-b pb-6">
        <div className="flex items-center gap-3">
          <div
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center border bg-muted/40 text-sm font-semibold"
          >
            {company.trim().slice(0, 2).toUpperCase() || "CO"}
          </div>
          <p className="text-sm font-medium">{company || "Company name"}</p>
        </div>
        <h3 className="text-2xl font-semibold leading-tight tracking-tight @min-[30rem]/job-preview:text-3xl">
          {content.title || "Job title"}
        </h3>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
            <MapPinIcon className="size-3.5 shrink-0" />
            {content.locations.length
              ? content.locations.join(", ")
              : "Location"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <BriefcaseBusinessIcon className="size-3.5 shrink-0" />
            {employmentLabels[content.employmentType]}
          </span>
          <span>{remoteLabels[content.remoteMode]}</span>
        </div>
      </header>
      <section className="space-y-3">
        <h4 className="text-sm font-semibold">About this role</h4>
        <p
          className={`whitespace-pre-wrap text-sm leading-7 ${content.description ? "" : "text-muted-foreground"}`}
        >
          {content.description || "Job description"}
        </p>
      </section>
      <section className="space-y-3 border-t pt-5">
        <h4 className="text-sm font-semibold">At a glance</h4>
        <dl className="grid grid-cols-1 gap-x-5 gap-y-4 text-sm @min-[26rem]/job-preview:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Experience</dt>
            <dd className="mt-1">{seniorityLabels[content.seniority]}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Compensation</dt>
            <dd className="mt-1">{formatCompensation(content)}</dd>
            {content.salaryStatus === "disclosed" &&
            content.salaryMin !== null ? (
              <dd className="mt-0.5 text-xs text-muted-foreground">
                Gross compensation
              </dd>
            ) : null}
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Countries of work</dt>
            <dd className="mt-1">
              {content.countryCodes.length
                ? content.countryCodes.join(", ")
                : "Not set"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Languages</dt>
            <dd className="mt-1">
              {content.languages.length
                ? content.languages.join(", ")
                : "Not set"}
            </dd>
          </div>
          {content.weeklyHours ? (
            <div>
              <dt className="text-xs text-muted-foreground">Hours per week</dt>
              <dd className="mt-1">{content.weeklyHours}</dd>
            </div>
          ) : null}
          {content.employmentType === "internship" &&
          content.internshipDurationMonths ? (
            <div>
              <dt className="text-xs text-muted-foreground">
                Internship duration
              </dt>
              <dd className="mt-1">
                {content.internshipDurationMonths}{" "}
                {content.internshipDurationMonths === 1 ? "month" : "months"}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>
      {companyDescription ? (
        <section className="space-y-2 border-t pt-5">
          <h4 className="text-sm font-semibold">
            About {company || "the company"}
          </h4>
          <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
            {companyDescription}
          </p>
        </section>
      ) : null}
      <div className="space-y-3 border-t pt-5">
        {hasApplication ? (
          <Button asChild className="w-full">
            <a
              href={content.applyUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Apply for this role
              <ArrowUpRightIcon className="size-4" />
            </a>
          </Button>
        ) : (
          <Button disabled className="w-full">
            Apply for this role
            <ArrowUpRightIcon className="size-4" />
          </Button>
        )}
        {companyWebsite && isSafePublicUrl(companyWebsite) ? (
          <p className="text-center">
            <a
              href={companyWebsite}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground underline underline-offset-4"
            >
              Company website
            </a>
          </p>
        ) : null}
      </div>
    </article>
  );
}
