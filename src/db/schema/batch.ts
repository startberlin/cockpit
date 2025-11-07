import { relations } from "drizzle-orm";
import { date, integer, pgTable } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const batch = pgTable("batch", {
  number: integer("number").notNull().primaryKey(),
  startDate: date("start_date").notNull(),
});

export const batchRelations = relations(batch, ({ many }) => ({
  users: many(user),
}));
