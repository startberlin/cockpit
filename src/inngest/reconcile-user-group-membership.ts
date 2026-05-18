import {
  pushAddToIntegrations,
  pushRemoveToIntegrations,
  reconcileUserGroupMembership,
} from "@/lib/groups/reconcile";
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
    const results = await step.run("reconcile-db-user", async () => {
      return await reconcileUserGroupMembership(event.data.id);
    });

    for (const result of results) {
      if (result.addedUsers.length > 0 || result.removedUsers.length > 0) {
        await step.run(`push-integrations-${result.groupId}`, async () => {
          await Promise.all([
            ...result.addedUsers.map((u) =>
              pushAddToIntegrations(result.group, u.email),
            ),
            ...result.removedUsers.map((u) =>
              pushRemoveToIntegrations(result.group, u.email),
            ),
          ]);
        });
      }
    }

    return { results };
  },
);
