import "server-only";

import { eq } from "drizzle-orm";
import db from "@/db";
import { user } from "@/db/schema/auth";
import { group } from "@/db/schema/group";
import {
  addGroupMember,
  removeGroupMember,
} from "@/lib/google-workspace/directory";
import { events, inngest } from "@/lib/inngest";

export const syncManualGroupMemberWorkflow = inngest.createFunction(
  {
    id: "sync-manual-group-member",
    triggers: [
      { event: events.groupMemberAdded },
      { event: events.groupMemberRemoved },
    ],
    // Serialize all operations for the same user+group pair to preserve time order.
    concurrency: {
      key: "event.data.userId + '-' + event.data.groupId",
      limit: 1,
    },
  },
  async ({ event, step }) => {
    const { groupId, userId } = event.data;

    const data = await step.run("load-data", async () => {
      const [g, u] = await Promise.all([
        db.query.group.findFirst({
          where: eq(group.id, groupId),
          columns: { googleGroupEmail: true },
        }),
        db.query.user.findFirst({
          where: eq(user.id, userId),
          columns: { email: true },
        }),
      ]);
      return {
        googleGroupEmail: g?.googleGroupEmail ?? null,
        email: u?.email ?? null,
      };
    });

    if (!data.googleGroupEmail || !data.email) return { skipped: true };

    if (event.name === events.groupMemberAdded.name) {
      await step.run("add-to-google-group", () =>
        addGroupMember(data.googleGroupEmail!, data.email!),
      );
    } else {
      await step.run("remove-from-google-group", () =>
        removeGroupMember(data.googleGroupEmail!, data.email!),
      );
    }
  },
);
