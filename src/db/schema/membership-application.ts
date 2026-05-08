import { relations } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { legalMembership } from "./legal-membership";

export const membershipApplication = pgTable("membership_application", {
  id: text("id").primaryKey(),
  legalMembershipId: text("legal_membership_id")
    .notNull()
    .unique()
    .references(() => legalMembership.id, { onDelete: "no action" }),
  subjectUserId: text("subject_user_id")
    .notNull()
    .references(() => user.id, { onDelete: "no action" }),
  street: text("street").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zip: text("zip").notNull(),
  country: text("country").notNull(),
  declarations: jsonb("declarations")
    .$type<{
      naturalPerson: true;
      legalCapacity: true;
      supportsPurpose: true;
      acceptsBylaws: true;
      acceptsPrivacyNotice: true;
      acknowledgesFee: true;
    }>()
    .notNull(),
  feeTextVersion: text("fee_text_version").notNull(),
  applicationVersion: text("application_version").notNull(),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
});

export const membershipApplicationRelations = relations(
  membershipApplication,
  ({ one }) => ({
    legalMembership: one(legalMembership, {
      fields: [membershipApplication.legalMembershipId],
      references: [legalMembership.id],
    }),
    subjectUser: one(user, {
      fields: [membershipApplication.subjectUserId],
      references: [user.id],
    }),
  }),
);
