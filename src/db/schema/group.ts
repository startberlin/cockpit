import { relations } from "drizzle-orm";
import {
  boolean,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const groupMemberRole = pgEnum("group_member_role", [
  "member",
  "manager",
]);

export const group = pgTable("group", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  emailEnabled: boolean("email_enabled").notNull().default(false),
  googleEmailPrefix: text("google_email_prefix"),
  googleGroupEmail: text("google_group_email"),
  googleSyncPending: boolean("google_sync_pending").notNull().default(false),
});

export const groupRelations = relations(group, ({ many }) => ({
  usersToGroups: many(usersToGroups),
}));

export const usersToGroups = pgTable(
  "users_to_groups",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    groupId: text("group_id")
      .notNull()
      .references(() => group.id),
    role: groupMemberRole("role").notNull().default("member"),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.groupId] })],
);

export const usersToGroupsRelations = relations(usersToGroups, ({ one }) => ({
  group: one(group, {
    fields: [usersToGroups.groupId],
    references: [group.id],
  }),
  user: one(user, {
    fields: [usersToGroups.userId],
    references: [user.id],
  }),
}));
