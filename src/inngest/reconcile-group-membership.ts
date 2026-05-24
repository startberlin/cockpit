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

export const reconcileGroupMembershipWorkflow = inngest.createFunction(
  {
    id: "reconcile-group-membership",
    name: "Sync Group to Google (on membership change)",
    triggers: [{ event: events.groupMembershipChanged.name }],
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

      await step.run("sync-google", async () => {
        const [googleEmails, dbMembers] = await Promise.all([
          listGroupMemberEmails(googleGroupEmail),
          db
            .select({ email: user.email })
            .from(usersToGroups)
            .innerJoin(user, eq(usersToGroups.userId, user.id))
            .where(eq(usersToGroups.groupId, groupId)),
        ]);

        const activeMembers = dbMembers.filter(
          (m): m is { email: string } => m.email !== null,
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
