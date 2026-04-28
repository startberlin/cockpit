import { relations } from "drizzle-orm";
import { pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const membershipPaymentStatus = pgEnum("membership_payment_status", [
  "pending",
  "checkout_started",
  "active",
  "failed",
  "cancelled",
]);

export type MembershipPaymentStatus =
  (typeof membershipPaymentStatus.enumValues)[number];

export const membershipPayment = pgTable("membership_payment", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  status: membershipPaymentStatus("status").notNull().default("pending"),
  provider: text("provider").notNull().default("gocardless"),
  gocardlessCustomerId: text("gocardless_customer_id").unique(),
  gocardlessBillingRequestId: text("gocardless_billing_request_id").unique(),
  gocardlessBillingRequestFlowId: text(
    "gocardless_billing_request_flow_id",
  ).unique(),
  gocardlessSubscriptionId: text("gocardless_subscription_id").unique(),
  gocardlessMandateId: text("gocardless_mandate_id").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  activatedAt: timestamp("activated_at"),
});

export const membershipPaymentRelations = relations(
  membershipPayment,
  ({ one }) => ({
    user: one(user, {
      fields: [membershipPayment.userId],
      references: [user.id],
    }),
  }),
);
