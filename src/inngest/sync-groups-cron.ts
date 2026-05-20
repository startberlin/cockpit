import { and, eq, isNotNull } from "drizzle-orm";
import { Common } from "googleapis";
import db from "@/db";
import { user } from "@/db/schema/auth";
import { group, groupCriteria, usersToGroups } from "@/db/schema/group";
import {
  addGroupMember,
  createGoogleGroup,
  listGroupMemberEmails,
  removeGroupMember,
} from "@/lib/google-workspace/directory";
import { reconcileGroupMembership } from "@/lib/groups/reconcile";
import { inngest } from "@/lib/inngest";

async function listGroupMemberEmailsOrNull(
  groupEmail: string,
): Promise<string[] | null> {
  try {
    return await listGroupMemberEmails(groupEmail);
  } catch (error) {
    if (error instanceof Common.GaxiosError && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

export const syncGroupsCron = inngest.createFunction(
  {
    id: "sync-groups-cron",
    name: "Sync Groups (every 15 min)",
    triggers: [{ cron: "TZ=Europe/Berlin */15 * * * *" }],
  },
  async ({ step }) => {
    // Step 1: find all groups that have criteria and reconcile DB membership.
    const groupsToReconcile = await step.run(
      "find-groups-with-criteria",
      async () => {
        const [withCriteria, withOrphanedMembers] = await Promise.all([
          db
            .selectDistinct({ id: group.id })
            .from(group)
            .innerJoin(groupCriteria, eq(groupCriteria.groupId, group.id)),
          db
            .selectDistinct({ id: group.id })
            .from(group)
            .innerJoin(
              usersToGroups,
              and(
                eq(usersToGroups.groupId, group.id),
                eq(usersToGroups.source, "criteria"),
              ),
            ),
        ]);

        const seen = new Set<string>();
        const merged: { id: string }[] = [];
        for (const row of [...withCriteria, ...withOrphanedMembers]) {
          if (!seen.has(row.id)) {
            seen.add(row.id);
            merged.push(row);
          }
        }
        return merged;
      },
    );

    for (const g of groupsToReconcile) {
      try {
        await step.run(`reconcile-db-${g.id}`, () =>
          reconcileGroupMembership(g.id),
        );
      } catch (error) {
        console.error(
          `[sync-groups-cron] DB reconciliation failed for group ${g.id}`,
          error,
        );
      }
    }

    // Step 2: for every group with a Google email, sync actual membership.
    const groupsWithEmail = await step.run(
      "find-groups-with-google-email",
      () =>
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

    let googleAdded = 0;
    let googleRemoved = 0;

    for (const g of groupsWithEmail) {
      if (!g.googleGroupEmail) continue;
      const groupEmail = g.googleGroupEmail;

      try {
        // Returns null when the group doesn't exist in GWS (404).
        // dbMembers is fetched inside the step so replays use the cached result.
        const { googleEmails, dbMembers } = await step.run(
          `check-google-${g.id}`,
          async () => {
            const [googleEmails, dbMembers] = await Promise.all([
              listGroupMemberEmailsOrNull(groupEmail),
              db
                .select({ email: user.email, userId: user.id })
                .from(usersToGroups)
                .innerJoin(user, eq(usersToGroups.userId, user.id))
                .where(eq(usersToGroups.groupId, g.id)),
            ]);
            return { googleEmails, dbMembers };
          },
        );

        if (googleEmails === null) {
          if (!g.googleEmailPrefix) {
            continue;
          }

          await step.run(`recreate-google-${g.id}`, () =>
            createGoogleGroup(g.googleEmailPrefix!, g.name),
          );

          await Promise.all(
            dbMembers.map((m) =>
              step.run(`populate-${g.id}-${m.userId}`, () =>
                addGroupMember(groupEmail, m.email),
              ),
            ),
          );

          googleAdded += dbMembers.length;
        } else {
          const googleSet = new Set(
            googleEmails.map((email) => email.toLowerCase()),
          );
          const dbEmailSet = new Set(
            dbMembers.map((m) => m.email.toLowerCase()),
          );
          const toAdd = dbMembers.filter(
            (m) => !googleSet.has(m.email.toLowerCase()),
          );
          const toRemove = googleEmails.filter(
            (e) => !dbEmailSet.has(e.toLowerCase()),
          );

          await Promise.all([
            ...toAdd.map((m) =>
              step.run(`add-${g.id}-${m.userId}`, () =>
                addGroupMember(groupEmail, m.email),
              ),
            ),
            ...toRemove.map((e) =>
              step.run(`remove-${g.id}-${e}`, () =>
                removeGroupMember(groupEmail, e),
              ),
            ),
          ]);

          googleAdded += toAdd.length;
          googleRemoved += toRemove.length;
        }
      } catch (error) {
        console.error(
          `[sync-groups-cron] Google sync failed for group ${g.id}`,
          error,
        );
      }
    }

    return {
      reconciled: groupsToReconcile.length,
      googleGroups: groupsWithEmail.length,
      googleAdded,
      googleRemoved,
    };
  },
);
