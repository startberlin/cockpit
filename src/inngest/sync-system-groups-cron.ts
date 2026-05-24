import "server-only";

import { eq, isNotNull } from "drizzle-orm";
import db from "@/db";
import { user } from "@/db/schema/auth";
import { group, usersToGroups } from "@/db/schema/group";
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

    // Reconcile manual DB groups (groups with a googleGroupEmail set).
    const manualGroups = await step.run("load-manual-groups", () =>
      db
        .select({
          id: group.id,
          name: group.name,
          googleEmailPrefix: group.googleEmailPrefix,
          googleGroupEmail: group.googleGroupEmail,
        })
        .from(group)
        .where(isNotNull(group.googleGroupEmail)),
    );

    let manualAdded = 0;
    let manualRemoved = 0;

    for (const g of manualGroups) {
      if (!g.googleGroupEmail) continue;
      const groupEmail = g.googleGroupEmail;

      const { toAdd, toRemove } = await step.run(
        `reconcile-manual-${g.id}`,
        async () => {
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
              if (g.googleEmailPrefix) {
                await createGoogleGroup(g.googleEmailPrefix, g.name);
              }
              googleEmails = [];
            } else {
              throw error;
            }
          }

          const dbMembers = await db
            .select({ email: user.email })
            .from(usersToGroups)
            .innerJoin(user, eq(usersToGroups.userId, user.id))
            .where(eq(usersToGroups.groupId, g.id));

          const activeEmails = dbMembers
            .filter((m): m is { email: string } => m.email !== null)
            .map((m) => m.email);

          const googleSet = new Set(googleEmails.map((e) => e.toLowerCase()));
          const dbSet = new Set(activeEmails.map((e) => e.toLowerCase()));

          return {
            toAdd: activeEmails.filter((e) => !googleSet.has(e.toLowerCase())),
            toRemove: googleEmails.filter((e) => !dbSet.has(e.toLowerCase())),
          };
        },
      );

      for (const email of toAdd) {
        await step.run(`add-manual-${g.id}-${email}`, () =>
          addGroupMember(groupEmail, email),
        );
      }
      for (const email of toRemove) {
        await step.run(`remove-manual-${g.id}-${email}`, () =>
          removeGroupMember(groupEmail, email),
        );
      }

      manualAdded += toAdd.length;
      manualRemoved += toRemove.length;
    }

    return {
      systemGroups: groupDeltas.length,
      systemAdded: totalAdded,
      systemRemoved: totalRemoved,
      manualGroups: manualGroups.length,
      manualAdded,
      manualRemoved,
    };
  },
);
