import { and, eq, isNull, or } from "drizzle-orm";
import db from "@/db";
import { group } from "@/db/schema/group";
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

    if (pending.length === 0) {
      return { synced: 0 };
    }

    await step.sendEvent(
      "fanout-sync",
      pending.map((g) => ({
        name: events.groupSyncRequested.name,
        data: { id: g.id },
      })),
    );

    return { synced: pending.length };
  },
);
