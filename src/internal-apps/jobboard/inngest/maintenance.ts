import { inngest } from "@/lib/inngest";
import { service } from "../lib/service";

export const jobboardMaintenance = inngest.createFunction(
  {
    id: "jobboard-maintenance",
    name: "Jobboard expiry and retention",
    triggers: [{ cron: "TZ=Europe/Berlin 35 3 * * *" }],
  },
  async ({ step }) =>
    step.run("expire-jobs-and-prune-counts", () => service.runMaintenance()),
);
