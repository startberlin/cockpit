import { sql } from "drizzle-orm";
import { boolean, check, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const systemSettings = pgTable(
  "system_settings",
  {
    id: text("id").primaryKey().default("singleton"),
    maintenanceMode: boolean("maintenance_mode").notNull().default(false),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    check("system_settings_singleton_ck", sql`${table.id} = 'singleton'`),
  ],
);
