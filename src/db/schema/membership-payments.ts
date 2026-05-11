import { relations, sql } from "drizzle-orm";
import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const membershipPaymentCycleStatus = pgEnum(
  "membership_payment_cycle_status",
  [
    "proposed",
    "declined",
    "pending",
    "submitted",
    "confirmed",
    "paid_out",
    "failed",
    "cancelled",
    "charged_back",
  ],
);

export type MembershipPaymentCycleStatus =
  (typeof membershipPaymentCycleStatus.enumValues)[number];

export const membershipPayments = pgTable(
  "membership_payments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: membershipPaymentCycleStatus("status")
      .notNull()
      .default("proposed"),
    activationDate: date("activation_date").notNull(),
    amount: integer("amount").notNull().default(4000),
    gocardlessPaymentId: text("gocardless_payment_id").unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    // Partial unique index: only one in-flight row per member at a time
    uniqueIndex("membership_payments_user_in_flight_unique")
      .on(table.userId)
      .where(
        sql`${table.status} IN ('proposed', 'pending', 'submitted')`,
      ),
    index("membership_payments_user_id_idx").on(table.userId),
  ],
);

export type MembershipPaymentCycle =
  typeof membershipPayments.$inferSelect;

export const membershipPaymentsRelations = relations(
  membershipPayments,
  ({ one }) => ({
    user: one(user, {
      fields: [membershipPayments.userId],
      references: [user.id],
    }),
  }),
);
