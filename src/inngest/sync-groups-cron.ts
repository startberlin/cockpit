import { and, eq, isNull, or } from "drizzle-orm";
import db from "@/db";
import { group, groupCriteria, usersToGroups } from "@/db/schema/group";
import { reconcileGroupMembership } from "@/lib/groups/reconcile";
import { events, inngest } from "@/lib/inngest";

export const syncGroupsCron = inngest.createFunction(
  {
    id: "sync-groups-cron",
    name: "Sync Groups (every 15 min)",
    triggers: [{ cron: "TZ=Europe/Berlin */15 * * * *" }],
  },
  async ({ step }) => {
    const pending = await step.run("find-pending-groups", () =>
      db.query.group.findMany({
        where: or(
          and(eq(group.slackEnabled, true), isNull(group.slackChannelId)),
          and(eq(group.emailEnabled, true), isNull(group.googleGroupEmail)),
        ),
        columns: { id: true },
      }),
    );

    if (pending.length > 0) {
      await step.sendEvent(
        "fanout-sync",
        pending.map((g) => ({
          name: events.groupSyncRequested.name,
          data: { id: g.id },
        })),
      );
    }

    const groupsToReconcile = await step.run(
      "find-groups-with-criteria",
      async () => {
        // Include groups that have active criteria OR groups that still have
        // criteria-sourced members (so cleanup runs after the last criterion
        // is deleted — the INNER JOIN would otherwise skip them).
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

    const reconciliations: {
      groupId: string;
      added: number;
      removed: number;
    }[] = [];

    for (const g of groupsToReconcile) {
      try {
        const result = await step.run(`reconcile-${g.id}`, () =>
          reconcileGroupMembership(g.id),
        );
        reconciliations.push({
          groupId: result.groupId,
          added: result.added.length,
          removed: result.removed.length,
        });
      } catch (error) {
        console.error(
          `[sync-groups-cron] Reconciliation failed for group ${g.id}`,
          error,
        );
      }
    }

    return {
      synced: pending.length,
      reconciled: reconciliations.length,
      reconciliations,
    };
  },
);
