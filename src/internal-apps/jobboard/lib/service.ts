import "server-only";
import db from "@/db";
import { env } from "@/env";
import { createJobboardService } from "../db/service";

/** Callers must enforce Cockpit permissions or service credentials before invoking this object. */
export const service = createJobboardService(db, undefined, {
  emailEnabled: !env.DISABLE_EMAIL,
});
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
