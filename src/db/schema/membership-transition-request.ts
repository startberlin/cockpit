import { boolean, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const membershipTransitionType = pgEnum("membership_transition_type", [
  "cancellation",
  "alumni_request",
  "supporting_alumni_request",
]);

export type MembershipTransitionType =
  (typeof membershipTransitionType.enumValues)[number];

export const membershipTransitionStatus = pgEnum(
  "membership_transition_status",
  ["pending", "acknowledged", "retracted", "expired", "executed"],
);

export type MembershipTransitionStatus =
  (typeof membershipTransitionStatus.enumValues)[number];

export const membershipTransitionReason = pgEnum(
  "membership_transition_reason",
  ["resigned", "removed_by_board"],
);

export type MembershipTransitionReason =
  (typeof membershipTransitionReason.enumValues)[number];

// Records must never be deleted — admin tasks history depends on them.
export const membershipTransitionRequest = pgTable(
  "membership_transition_request",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "no action" }),
    type: membershipTransitionType("type").notNull(),
    status: membershipTransitionStatus("status").notNull().default("pending"),
    reason: membershipTransitionReason("reason"),
    keepPersonalEmail: boolean("keep_personal_email"),
    personalEmailForNotification: text("personal_email_for_notification"),
    requestedAt: timestamp("requested_at").notNull().defaultNow(),
    decidedAt: timestamp("decided_at"),
    decidedByUserId: text("decided_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
);

export type MembershipTransitionRequest =
  typeof membershipTransitionRequest.$inferSelect;
