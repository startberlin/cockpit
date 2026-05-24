import "server-only";

import db from "@/db";
import {
  addGroupMember,
  createGoogleGroup,
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
    // Compute expected membership per group in-memory and checkpoint only
    // email strings — not the full user/position rows.
    const groupDeltas = await step.run(
      "compute-expected-membership",
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

        return getAllSystemGroupSlugs(batches)
          .map((slug) => {
            const systemGroup = getSystemGroupBySlug(slug);
            if (!systemGroup) return null;

            const expectedEmails = getMembersOfSystemGroup(
              slug,
              users,
              positions,
            )
              .filter(
                (u): u is typeof u & { email: string } => u.email !== null,
              )
              .map((u) => u.email.toLowerCase());

            return {
              slug,
              groupEmail: systemGroup.googleGroupEmail,
              googleEmailPrefix: systemGroup.googleEmailPrefix,
              name: systemGroup.name,
              expectedEmails,
            };
          })
          .filter((g): g is NonNullable<typeof g> => g !== null);
      },
    );

    let totalAdded = 0;
    let totalRemoved = 0;

    for (const {
      slug,
      groupEmail,
      googleEmailPrefix,
      name,
      expectedEmails,
    } of groupDeltas) {
      const { toAdd, toRemove } = await step.run(
        `reconcile-${slug}`,
        async () => {
          const expectedSet = new Set(expectedEmails);

          let googleEmails: string[];
          try {
            googleEmails = await listGroupMemberEmails(groupEmail);
          } catch (error) {
            if (
              typeof error === "object" &&
              error !== null &&
              (error as { response?: { status?: number } }).response?.status ===
                404
            ) {
              await createGoogleGroup(googleEmailPrefix, name);
              googleEmails = [];
            } else {
              throw error;
            }
          }
          const googleSet = new Set(googleEmails.map((e) => e.toLowerCase()));

          return {
            toAdd: expectedEmails.filter((e) => !googleSet.has(e)),
            toRemove: googleEmails.filter(
              (e) => !expectedSet.has(e.toLowerCase()),
            ),
          };
        },
      );

      for (const email of toAdd) {
        await step.run(`add-${slug}-${email}`, () =>
          addGroupMember(groupEmail, email),
        );
      }
      for (const email of toRemove) {
        await step.run(`remove-${slug}-${email}`, () =>
          removeGroupMember(groupEmail, email),
        );
      }

      totalAdded += toAdd.length;
      totalRemoved += toRemove.length;
    }

    return { groups: groupDeltas.length, totalAdded, totalRemoved };
  },
);
