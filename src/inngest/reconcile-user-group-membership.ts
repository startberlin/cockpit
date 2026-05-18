import { reconcileUserGroupMembership } from "@/lib/groups/reconcile";
import { events, inngest } from "@/lib/inngest";

export const reconcileUserGroupMembershipWorkflow = inngest.createFunction(
  {
    id: "reconcile-user-group-membership",
    triggers: [{ event: events.cockpitUserUpdated }],
    concurrency: {
      key: "event.data.id",
      limit: 1,
    },
  },
  async ({ event, step }) => {
    const results = await step.run("reconcile-db-user", () =>
      reconcileUserGroupMembership(event.data.id),
    );

    return { reconciled: results.length };
  },
);
