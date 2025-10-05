import { pgTable, text } from "drizzle-orm/pg-core";

export const department = pgTable("department", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  leadMemberId: text("lead_member_id").notNull(),
});
