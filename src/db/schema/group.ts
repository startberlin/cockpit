import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { department, user, userStatus } from "./auth";

export const groupRole = pgEnum("group_role", ["admin", "member"]);

export const groupMembershipSource = pgEnum("group_membership_source", [
  "criteria",
  "manual",
]);

export const group = pgTable("group", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  slackEnabled: boolean("slack_enabled").notNull().default(false),
  slackChannelId: text("slack_channel_id"),
  emailEnabled: boolean("email_enabled").notNull().default(false),
  googleGroupEmail: text("google_group_email"),
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
  department: department("department"),
  status: userStatus("status"),
  batchNumber: integer("batch_number"),
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
    role: groupRole("role").notNull().default("member"),
    source: groupMembershipSource("source").notNull().default("manual"),
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
