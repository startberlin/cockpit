import { relations } from "drizzle-orm";
import {
  boolean,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const groupMembershipSource = pgEnum("group_membership_source", [
  "criteria",
  "manual",
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
  criteria: many(groupCriteria),
}));

export const groupCriteria = pgTable("group_criteria", {
  id: text("id").primaryKey(),
  groupId: text("group_id")
    .notNull()
    .references(() => group.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  conditions: jsonb("conditions").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id),
});

export const groupCriteriaRelations = relations(groupCriteria, ({ one }) => ({
  group: one(group, {
    fields: [groupCriteria.groupId],
    references: [group.id],
  }),
  createdByUser: one(user, {
    fields: [groupCriteria.createdBy],
    references: [user.id],
  }),
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
    source: groupMembershipSource("source").notNull().default("manual"),
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
