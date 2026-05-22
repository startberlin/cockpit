import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const memberActionType = pgEnum("member_action_type", [
  "complete_application",
  "reconfirm_membership",
  "setup_mandate",
  "fix_mandate",
  "acknowledge_cancellation",
  "decide_transition",
  "vote_admission",
]);

export type MemberActionType = (typeof memberActionType.enumValues)[number];

export const memberActionReminder = pgTable(
  "member_action_reminder",
  {
    id: text("id").primaryKey(),
    recipientUserId: text("recipient_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    actionType: memberActionType("action_type").notNull(),
    // Identifier of the entity the action is about:
    // legalMembershipId, transitionRequestId, or recipient's own userId for mandate actions.
    subjectId: text("subject_id").notNull(),
    firstObservedAt: timestamp("first_observed_at").notNull().defaultNow(),
    lastReminderAt: timestamp("last_reminder_at").notNull().defaultNow(),
    reminderCount: integer("reminder_count").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("member_action_reminder_uniq").on(
      t.recipientUserId,
      t.actionType,
      t.subjectId,
    ),
  ],
);

export type MemberActionReminder = typeof memberActionReminder.$inferSelect;
