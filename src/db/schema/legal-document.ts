import { relations } from "drizzle-orm";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { legalMembership } from "./legal-membership";

export const legalDocument = pgTable("legal_document", {
  id: text("id").primaryKey(),
  legalMembershipId: text("legal_membership_id")
    .notNull()
    .references(() => legalMembership.id, { onDelete: "no action" }),
  documentType: text("document_type").notNull(),
  sha256: text("sha256").notNull(),
  driveFileId: text("drive_file_id").notNull(),
  driveUrl: text("drive_url").notNull(),
  renderer: text("renderer").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const legalDocumentRelations = relations(legalDocument, ({ one }) => ({
  legalMembership: one(legalMembership, {
    fields: [legalDocument.legalMembershipId],
    references: [legalMembership.id],
  }),
}));
