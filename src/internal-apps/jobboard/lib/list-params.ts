import {
  type inferParserType,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";
import { jobStatuses } from "./contracts";

export const listParams = {
  page: parseAsInteger.withDefault(1),
  q: parseAsString.withDefault(""),
};
export const jobFilterStatuses = ["all", ...jobStatuses] as const;
export const jobSortOptions = ["updated", "expiry", "title"] as const;
export const jobListParams = {
  ...listParams,
  status: parseAsStringLiteral(jobFilterStatuses).withDefault("all"),
  sort: parseAsStringLiteral(jobSortOptions).withDefault("updated"),
};
export const submissionListParams = {
  ...listParams,
  status: parseAsStringLiteral([
    "pending_review",
    "accepted",
    "rejected",
    "all",
  ] as const).withDefault("pending_review"),
};
export type ListQuery = inferParserType<typeof listParams>;
export type JobListQuery = inferParserType<typeof jobListParams>;
export type SubmissionListQuery = inferParserType<typeof submissionListParams>;
export const MANAGEMENT_PAGE_SIZE = 25;
export type ListPagination = {
  page: number;
  pageCount: number;
  matched: number;
};
