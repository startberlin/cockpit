import { relations } from "drizzle-orm";
import { pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const legalMembershipStatus = pgEnum("legal_membership_status", [
  "admission_pending",
  "application_pending",
  "processing",
  "active",
  "manual_followup",
  "cancelled",
]);

export type LegalMembershipStatus =
  (typeof legalMembershipStatus.enumValues)[number];

export const legalMembership = pgTable("legal_membership", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "no action" }),
  status: legalMembershipStatus("status").notNull(),
  inngestRunId: text("inngest_run_id"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  activatedAt: timestamp("activated_at"),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Note: A partial unique index is added in the migration:
// CREATE UNIQUE INDEX "legal_membership_active_tenure_idx" ON "legal_membership" ("user_id")
// WHERE status IN ('admission_pending', 'application_pending', 'processing', 'active');

export const legalMembershipRelations = relations(
  legalMembership,
  ({ one }) => ({
    user: one(user, {
      fields: [legalMembership.userId],
      references: [user.id],
    }),
  }),
);
