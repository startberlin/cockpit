import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const gocardlessProcessedEvents = pgTable(
  "gocardless_processed_events",
  {
    eventId: text("event_id").primaryKey(),
    processedAt: timestamp("processed_at").defaultNow().notNull(),
  },
);
