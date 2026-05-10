import { relations } from "drizzle-orm";
import { pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { legalMembership } from "./legal-membership";

export const taskStatus = pgEnum("task_status", [
  "open",
  "completed",
  "cancelled",
]);

export type TaskStatus = (typeof taskStatus.enumValues)[number];

export const task = pgTable("task", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  assigneeUserId: text("assignee_user_id")
    .notNull()
    .references(() => user.id, { onDelete: "no action" }),
  title: text("title").notNull(),
  description: text("description"),
  status: taskStatus("status").notNull().default("open"),
  dueAt: timestamp("due_at"),
  completedAt: timestamp("completed_at"),
  completedByUserId: text("completed_by_user_id").references(() => user.id, {
    onDelete: "no action",
  }),
  legalMembershipId: text("legal_membership_id").references(
    () => legalMembership.id,
    { onDelete: "no action" },
  ),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const taskRelations = relations(task, ({ one }) => ({
  assignee: one(user, {
    fields: [task.assigneeUserId],
    references: [user.id],
    relationName: "taskAssignee",
  }),
  completedBy: one(user, {
    fields: [task.completedByUserId],
    references: [user.id],
    relationName: "taskCompletedBy",
  }),
  legalMembership: one(legalMembership, {
    fields: [task.legalMembershipId],
    references: [legalMembership.id],
  }),
}));
