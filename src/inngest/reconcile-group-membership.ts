import { eq } from "drizzle-orm";
import db from "@/db";
import { user } from "@/db/schema/auth";
import { group, usersToGroups } from "@/db/schema/group";
import {
  addGroupMember,
  listGroupMemberEmails,
  removeGroupMember,
} from "@/lib/google-workspace/directory";
import { events, inngest } from "@/lib/inngest";
import { buildSubjectMetadata, getPostHogClient } from "@/lib/posthog-server";

export const reconcileGroupMembershipWorkflow = inngest.createFunction(
  {
    id: "reconcile-group-membership",
    name: "Sync Group to Google (on criteria change)",
    triggers: [{ event: events.groupCriteriaChanged.name }],
    debounce: {
      key: "event.data.groupId",
      period: "15s",
    },
  },
  async ({ event, step }) => {
    const { groupId } = event.data;

    const g = await step.run("get-group", () =>
      db.query.group.findFirst({
        where: eq(group.id, groupId),
        columns: { id: true, googleGroupEmail: true },
      }),
    );

    if (g?.googleGroupEmail) {
      const googleGroupEmail = g.googleGroupEmail;

      const syncResult = await step.run("sync-google", async () => {
        const [googleEmails, dbMembers] = await Promise.all([
          listGroupMemberEmails(googleGroupEmail),
          db
            .select({ userId: usersToGroups.userId, email: user.email })
            .from(usersToGroups)
            .innerJoin(user, eq(usersToGroups.userId, user.id))
            .where(eq(usersToGroups.groupId, groupId)),
        ]);

        const activeMembers = dbMembers.filter(
          (m): m is { userId: string; email: string } => m.email !== null,
        );
        const googleSet = new Set(googleEmails);
        const dbEmailSet = new Set(
          activeMembers.map((m) => m.email.toLowerCase()),
        );

        const toAdd = activeMembers.filter(
          (m) => !googleSet.has(m.email.toLowerCase()),
        );
        const toRemove = googleEmails.filter((e) => !dbEmailSet.has(e));

        await Promise.all([
          ...toAdd.map((m) => addGroupMember(googleGroupEmail, m.email)),
          ...toRemove.map((e) => removeGroupMember(googleGroupEmail, e)),
        ]);

        return {
          addedUserIds: toAdd.map((m) => m.userId),
          removedEmails: toRemove,
        };
      });

      await step.run("capture-analytics-group-sync", async () => {
        try {
          const ph = getPostHogClient();
          if (!ph) return;

          for (const userId of syncResult.addedUserIds) {
            const userRecord = await db.query.user.findFirst({
              where: (u, { eq: eqFn }) => eqFn(u.id, userId),
              columns: {
                id: true,
                status: true,
                department: true,
                batchNumber: true,
                legalMembershipState: true,
                memberSinceDate: true,
              },
            });
            if (userRecord) {
              ph.capture({
                distinctId: userId,
                event: "workflow_group_member_added",
                properties: {
                  group_id: groupId,
                  reason: "criteria_match",
                  ...buildSubjectMetadata(userRecord),
                },
              });
            }
          }

          if (syncResult.removedEmails.length > 0) {
            const removedUsers = await db.query.user.findMany({
              where: (u, { inArray }) =>
                inArray(u.email, syncResult.removedEmails),
              columns: {
                id: true,
                status: true,
                department: true,
                batchNumber: true,
                legalMembershipState: true,
                memberSinceDate: true,
              },
            });
            for (const userRecord of removedUsers) {
              ph.capture({
                distinctId: userRecord.id,
                event: "workflow_group_member_removed",
                properties: {
                  group_id: groupId,
                  reason: "criteria_no_longer_matches",
                  ...buildSubjectMetadata(userRecord),
                },
              });
            }
          }
        } catch (err) {
          console.error(
            "[reconcile-group-membership] posthog capture failed",
            err,
          );
        }
      });
    }

    await step.run("clear-sync-pending", () =>
      db
        .update(group)
        .set({ googleSyncPending: false })
        .where(eq(group.id, groupId)),
    );
  },
);
