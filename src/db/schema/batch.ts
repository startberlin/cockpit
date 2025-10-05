import { date, integer, pgTable } from "drizzle-orm/pg-core";

export const batch = pgTable("batch", {
  number: integer("number").notNull().primaryKey(),
  startDate: date("start_date").notNull(),
});
