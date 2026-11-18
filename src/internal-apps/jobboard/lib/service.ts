import "server-only";
import db from "@/db";
import { createJobboardService } from "../db/service";

/** Callers must enforce Cockpit permissions or service credentials before invoking this object. */
export const service = createJobboardService(db);
export type {
  JobboardActor,
  JobboardCompany,
  JobboardJob,
  JobboardSubmission,
  MetricTotals,
  SaveCompanyInput,
  SaveJobInput,
} from "../db/service";
export { JobboardError } from "../db/service";
