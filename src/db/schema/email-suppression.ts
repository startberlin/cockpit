import { pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const emailSuppressionReason = pgEnum("email_suppression_reason", [
  "bounce",
  "complaint",
]);

export type EmailSuppressionReason =
  (typeof emailSuppressionReason.enumValues)[number];

export const emailSuppression = pgTable("email_suppression", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  reason: emailSuppressionReason("reason").notNull(),
  detail: text("detail"),
  suppressedAt: timestamp("suppressed_at").notNull().defaultNow(),
});
