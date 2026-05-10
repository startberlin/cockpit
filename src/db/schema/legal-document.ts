import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { legalMembership } from "./legal-membership";

export type LegalDocumentType =
  | "board_resolution"
  | "membership_application"
  | "admission_confirmation";

export const legalDocument = pgTable(
  "legal_document",
  {
    id: text("id").primaryKey(),
    legalMembershipId: text("legal_membership_id")
      .notNull()
      .references(() => legalMembership.id, { onDelete: "no action" }),
    documentType: text("document_type").notNull().$type<LegalDocumentType>(),
    sha256: text("sha256").notNull(),
    driveFileId: text("drive_file_id").notNull(),
    driveUrl: text("drive_url").notNull(),
    renderer: text("renderer").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.legalMembershipId, t.documentType),
    index("legal_document_legal_membership_id_idx").on(t.legalMembershipId),
  ],
);

export const legalDocumentRelations = relations(legalDocument, ({ one }) => ({
  legalMembership: one(legalMembership, {
    fields: [legalDocument.legalMembershipId],
    references: [legalMembership.id],
  }),
}));
