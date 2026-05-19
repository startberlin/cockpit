import { lt, sql } from "drizzle-orm";
import db from "@/db";
import { gocardlessProcessedEvents } from "@/db/schema/gocardless-processed-events";
import { inngest } from "@/lib/inngest";

export const gocardlessEventsCleanupCron = inngest.createFunction(
  {
    id: "gocardless-events-cleanup-cron",
    name: "GoCardless Events Cleanup (daily)",
    triggers: [{ cron: "TZ=Europe/Berlin 0 3 * * *" }],
  },
  async ({ step }) => {
    const deleted = await step.run("delete-old-events", async () => {
      const thirtyDaysAgo = sql`NOW() - INTERVAL '30 days'`;

      const result = await db
        .delete(gocardlessProcessedEvents)
        .where(lt(gocardlessProcessedEvents.processedAt, thirtyDaysAgo))
        .returning({ eventId: gocardlessProcessedEvents.eventId });

      return { deletedCount: result.length };
    });

    return deleted;
  },
);
