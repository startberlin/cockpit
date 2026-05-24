import "server-only";

import db from "@/db";
import {
  addGroupMember,
  removeGroupMember,
} from "@/lib/google-workspace/directory";
import { getSystemGroupsForUser } from "@/lib/groups/system-groups";
import { events, inngest } from "@/lib/inngest";

export const syncUserSystemGroupsWorkflow = inngest.createFunction(
  {
    id: "sync-user-system-groups",
    triggers: [{ event: events.userSystemGroupsSync }],
    concurrency: {
      key: "event.data.userId",
      limit: 1,
    },
  },
  async ({ event, step }) => {
    const { userId, before, after } = event.data;

    const syncData = await step.run("compute-diff", async () => {
      const [positions, batches] = await Promise.all([
        db.query.userOrganizationPosition.findMany({
          where: (p, { eq }) => eq(p.userId, userId),
          columns: { position: true, scope: true, department: true },
        }),
        db.query.batch.findMany({ columns: { number: true } }),
      ]);

      const beforeGroups = getSystemGroupsForUser(
        { id: userId, ...before },
        positions,
        batches,
      );
      const afterGroups = getSystemGroupsForUser(
        { id: userId, ...after },
        positions,
        batches,
      );

      const beforeSlugs = new Set(beforeGroups.map((g) => g.slug));
      const afterSlugs = new Set(afterGroups.map((g) => g.slug));

      return {
        toAdd: afterGroups.filter((g) => !beforeSlugs.has(g.slug)),
        toRemove: beforeGroups.filter((g) => !afterSlugs.has(g.slug)),
      };
    });

    if (syncData.toAdd.length === 0 && syncData.toRemove.length === 0) {
      return { added: 0, removed: 0 };
    }

    await step.run("sync-google", async () => {
      const userRecord = await db.query.user.findFirst({
        where: (u, { eq }) => eq(u.id, userId),
        columns: { email: true },
      });

      if (!userRecord?.email) return;

      const { email } = userRecord;

      await Promise.all([
        ...syncData.toAdd.map((g) => addGroupMember(g.googleGroupEmail, email)),
        ...syncData.toRemove.map((g) =>
          removeGroupMember(g.googleGroupEmail, email),
        ),
      ]);
    });

    return { added: syncData.toAdd.length, removed: syncData.toRemove.length };
  },
);
