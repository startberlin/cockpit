import "server-only";

import db from "@/db";
import {
  addGroupMember,
  listGroupMemberEmails,
  removeGroupMember,
} from "@/lib/google-workspace/directory";
import {
  getAllSystemGroupSlugs,
  getMembersOfSystemGroup,
  getSystemGroupBySlug,
} from "@/lib/groups/system-groups";
import { inngest } from "@/lib/inngest";

export const syncSystemGroupsCron = inngest.createFunction(
  {
    id: "sync-system-groups-cron",
    name: "Reconcile System Groups (daily)",
    triggers: [{ cron: "TZ=Europe/Berlin 0 3 * * *" }],
  },
  async ({ step }) => {
    const { users, positions, batches } = await step.run(
      "load-data",
      async () => {
        const [users, positions, batches] = await Promise.all([
          db.query.user.findMany({
            columns: {
              id: true,
              status: true,
              department: true,
              batchNumber: true,
              email: true,
            },
          }),
          db.query.userOrganizationPosition.findMany({
            columns: {
              userId: true,
              position: true,
              scope: true,
              department: true,
            },
          }),
          db.query.batch.findMany({
            columns: { number: true },
          }),
        ]);
        return { users, positions, batches };
      },
    );

    const slugs = getAllSystemGroupSlugs(batches);
    let totalAdded = 0;
    let totalRemoved = 0;

    for (const slug of slugs) {
      const systemGroup = getSystemGroupBySlug(slug);
      if (!systemGroup) continue;

      const groupEmail = systemGroup.googleGroupEmail;

      const result = await step.run(`reconcile-${slug}`, async () => {
        const expectedMembers = getMembersOfSystemGroup(slug, users, positions);
        const expectedEmails = new Set(
          expectedMembers
            .filter((u): u is typeof u & { email: string } => u.email !== null)
            .map((u) => u.email.toLowerCase()),
        );

        const googleEmails = await listGroupMemberEmails(groupEmail);
        const googleSet = new Set(googleEmails.map((e) => e.toLowerCase()));

        const toAdd = expectedMembers.filter(
          (u): u is typeof u & { email: string } =>
            u.email !== null && !googleSet.has(u.email.toLowerCase()),
        );
        const toRemove = googleEmails.filter(
          (e) => !expectedEmails.has(e.toLowerCase()),
        );

        await Promise.all([
          ...toAdd.map((u) => addGroupMember(groupEmail, u.email)),
          ...toRemove.map((e) => removeGroupMember(groupEmail, e)),
        ]);

        return { added: toAdd.length, removed: toRemove.length };
      });

      totalAdded += result.added;
      totalRemoved += result.removed;
    }

    return { groups: slugs.length, totalAdded, totalRemoved };
  },
);
