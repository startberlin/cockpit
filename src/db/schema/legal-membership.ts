import { relations } from "drizzle-orm";
import { pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const legalMembershipState = pgEnum("legal_membership_state", [
  "not_member",
  "active_member",
  "former_member",
]);

export type LegalMembershipState =
  (typeof legalMembershipState.enumValues)[number];

export const legalMembershipDocumentStatus = pgEnum(
  "legal_membership_document_status",
  ["not_required", "verified", "missing_or_unsure"],
);

export type LegalMembershipDocumentStatus =
  (typeof legalMembershipDocumentStatus.enumValues)[number];

export const legalMembership = pgTable("legal_membership", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id),
  state: legalMembershipState("state").notNull().default("not_member"),
  documentStatus: legalMembershipDocumentStatus("document_status")
    .notNull()
    .default("missing_or_unsure"),
  classifiedByUserId: text("classified_by_user_id").references(() => user.id),
  classifiedAt: timestamp("classified_at"),
  activatedAt: timestamp("activated_at"),
  formerAt: timestamp("former_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const legalMembershipRelations = relations(
  legalMembership,
  ({ one }) => ({
    user: one(user, {
      fields: [legalMembership.userId],
      references: [user.id],
      relationName: "legalMembershipUser",
    }),
    classifiedByUser: one(user, {
      fields: [legalMembership.classifiedByUserId],
      references: [user.id],
      relationName: "legalMembershipClassifier",
    }),
  }),
);
