import "server-only";

import db from "@/db";
import {
  addGroupMember,
  createGoogleGroup,
  listGroupMemberEmails,
  removeGroupMember,
} from "@/lib/google-workspace/directory";
import {
  getAllSystemGroups,
  getEnvEmailPrefix,
  getSystemGroupBySlug,
  getSystemGroupsForUser,
} from "@/lib/groups/system-groups";
import { events, inngest } from "@/lib/inngest";
import { syncGroupMembership } from "./lib/sync-group-membership";

const googleDeps = {
  listGroupMemberEmails,
  addGroupMember,
  removeGroupMember,
  createGoogleGroup,
  getGroupName: (prefix: string) => {
    const envPrefix = getEnvEmailPrefix();
    const slug =
      envPrefix && prefix.startsWith(envPrefix)
        ? prefix.slice(envPrefix.length)
        : prefix;
    return getSystemGroupBySlug(slug)?.name ?? prefix;
  },
};

export const syncPositionSystemGroupsWorkflow = inngest.createFunction(
  {
    id: "sync-position-system-groups",
    triggers: [{ event: events.positionsSystemGroupsSync }],
    concurrency: {
      scope: "account",
      key: "event.data.userId",
      limit: 1,
    },
  },
  async ({ event, step }) => {
    const { userId } = event.data;

    const { positions, user, batches } = await step.run(
      "load-data",
      async () => {
        const [positionRows, userRecord, batchRows] = await Promise.all([
          db.query.userOrganizationPosition.findMany({
            where: (p, { eq }) => eq(p.userId, userId),
            columns: { position: true, scope: true, department: true },
          }),
          db.query.user.findFirst({
            where: (u, { eq }) => eq(u.id, userId),
            columns: {
              email: true,
              status: true,
              department: true,
              batchNumber: true,
            },
          }),
          db.query.batch.findMany({ columns: { number: true } }),
        ]);
        return {
          positions: positionRows,
          user: userRecord,
          batches: batchRows,
        };
      },
    );

    if (!user?.email) return { skipped: true };

    const { email } = user;
    const expectedGroupEmails = new Set(
      getSystemGroupsForUser({ id: userId, ...user }, positions, batches).map(
        (g) => g.googleGroupEmail,
      ),
    );

    const allGroups = getAllSystemGroups(batches);

    for (const group of allGroups) {
      await step.run(`sync-${group.slug}`, () =>
        syncGroupMembership(
          group.googleGroupEmail,
          expectedGroupEmails.has(group.googleGroupEmail),
          email,
          googleDeps,
        ),
      );
    }

    return { synced: true };
  },
);
