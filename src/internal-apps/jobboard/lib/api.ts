import "server-only";
import { after } from "next/server";
import { env } from "@/env";
import { events, inngest } from "@/lib/inngest";
import { createJobboardHttp } from "./http";
import { service } from "./service";

export const jobboardApi = createJobboardHttp(
  service,
  () => ({
    read: env.JOBBOARD_READ_API_KEY,
    submit: env.JOBBOARD_SUBMIT_API_KEY,
    metrics: env.JOBBOARD_METRICS_API_KEY,
  }),
  (submissionId) => {
    if (env.DISABLE_EMAIL) return;
    after(async () => {
      try {
        await inngest.send({
          id: `jobboard-mail-${submissionId}`,
          name: events.jobboardSubmissionReceived.name,
          data: { submissionId },
        });
      } catch {
        // The scheduled sweep also processes committed rows when an event is lost.
        console.error(
          "[jobboard-email] Could not dispatch the outbox wake-up.",
        );
      }
    });
  },
);
