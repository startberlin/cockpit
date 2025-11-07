import { relations } from "drizzle-orm";
import { pgTable, text } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const department = pgTable("department", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  leadMemberId: text("lead_member_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const departmentRelations = relations(department, ({ many, one }) => ({
  users: many(user),
  leadMember: one(user),
}));
