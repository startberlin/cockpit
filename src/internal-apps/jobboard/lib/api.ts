import "server-only";
import { env } from "@/env";
import { createJobboardHttp } from "./http";
import { service } from "./service";

export const jobboardApi = createJobboardHttp(service, () => ({
  read: env.JOBBOARD_READ_API_KEY,
  submit: env.JOBBOARD_SUBMIT_API_KEY,
  metrics: env.JOBBOARD_METRICS_API_KEY,
}));
