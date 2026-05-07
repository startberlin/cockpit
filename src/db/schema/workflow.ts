import { relations, sql } from "drizzle-orm";
import { jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const workflowStatus = pgEnum("workflow_status", [
  "open",
  "completed",
  "manual_followup",
  "cancelled",
]);

export type WorkflowStatus = (typeof workflowStatus.enumValues)[number];

export const workflow = pgTable("workflow", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  status: workflowStatus("status").notNull().default("open"),
  subjectUserId: text("subject_user_id").references(() => user.id),
  createdByUserId: text("created_by_user_id").references(() => user.id),
  metadata: jsonb("metadata")
    .$type<Record<string, unknown>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
});

export const workflowRelations = relations(workflow, ({ one }) => ({
  subjectUser: one(user, {
    fields: [workflow.subjectUserId],
    references: [user.id],
    relationName: "workflowSubjectUser",
  }),
  createdByUser: one(user, {
    fields: [workflow.createdByUserId],
    references: [user.id],
    relationName: "workflowCreator",
  }),
}));
