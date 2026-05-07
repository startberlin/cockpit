import { inngest } from "@/lib/inngest";

export const membershipLifecycleWorkflow = inngest.createFunction(
  {
    id: "membership-lifecycle",
    idempotency: "event.data.workflowId",
  },
  { event: "membership/admission-application.submitted" },
  async ({ event, step }) => {
    await step.run("admission-application-submitted", async () => {
      return {
        workflowId: event.data.workflowId,
        userId: event.data.userId,
      };
    });
  },
);
