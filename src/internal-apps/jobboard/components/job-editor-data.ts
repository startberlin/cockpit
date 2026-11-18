import type { JobContent } from "../lib/contracts";

export const employmentLabels: Record<JobContent["employmentType"], string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
  working_student: "Working student",
  temporary: "Temporary",
  volunteer: "Volunteer",
  other: "Other",
};
export const seniorityLabels: Record<JobContent["seniority"], string> = {
  entry: "Entry level",
  mid: "Mid-level",
  senior: "Senior",
  lead: "Lead",
  all: "All experience levels",
};
export const remoteLabels: Record<JobContent["remoteMode"], string> = {
  onsite: "On-site",
  hybrid: "Hybrid",
  remote: "Remote",
};
export type JobEditorCompany = {
  id: string;
  name: string;
  website: string;
  description: string;
};

export function formatCompensation(content: JobContent): string {
  if (content.salaryStatus === "unpaid") return "Unpaid";
  if (content.salaryStatus === "not_disclosed") return "Not disclosed";
  if (content.salaryMin === null || !Number.isFinite(content.salaryMin))
    return "Add a salary amount";
  const minimum = content.salaryMin.toLocaleString("en-GB");
  const maximum =
    content.salaryMax !== null && Number.isFinite(content.salaryMax)
      ? ` to ${content.salaryMax.toLocaleString("en-GB")}`
      : "";
  return `${content.salaryCurrency || "Currency"} ${minimum}${maximum} / ${content.salaryPeriod}`;
}
