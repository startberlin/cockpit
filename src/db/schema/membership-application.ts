import { relations } from "drizzle-orm";
import {
  date,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import { user } from "./auth";
import { legalMembership } from "./legal-membership";

export const membershipApplicationStatus = pgEnum(
  "membership_application_status",
  ["draft", "submitted"],
);

export type MembershipApplicationStatus =
  (typeof membershipApplicationStatus.enumValues)[number];

export type MembershipApplicationDeclarations = {
  naturalPerson?: true;
  legalCapacity?: true;
  supportsPurpose?: true;
  acceptsBylaws?: true;
  acceptsFinancialRegulations?: true;
  acknowledgesFee?: true;
};

export type FullMembershipApplicationDeclarations =
  Required<MembershipApplicationDeclarations>;

export function isFullDeclarations(
  d: MembershipApplicationDeclarations | null | undefined,
): d is FullMembershipApplicationDeclarations {
  return (
    !!d?.naturalPerson &&
    !!d?.legalCapacity &&
    !!d?.supportsPurpose &&
    !!d?.acceptsBylaws &&
    !!d?.acceptsFinancialRegulations &&
    !!d?.acknowledgesFee
  );
}

export const membershipApplication = pgTable("membership_application", {
  id: text("id").primaryKey(),
  legalMembershipId: text("legal_membership_id")
    .notNull()
    .unique()
    .references(() => legalMembership.id, { onDelete: "no action" }),
  subjectUserId: text("subject_user_id")
    .notNull()
    .references(() => user.id, { onDelete: "no action" }),
  status: membershipApplicationStatus("status").notNull().default("draft"),

  // Personal info — filled in step 1
  personalEmail: text("personal_email"),
  phone: text("phone"),
  street: text("street"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  country: text("country"),
  birthDate: date("birth_date"),

  // Declarations — merged progressively across steps 2–4
  declarations:
    jsonb("declarations").$type<MembershipApplicationDeclarations>(),

  // Set at submission time
  feeTextVersion: text("fee_text_version"),
  applicationVersion: text("application_version"),
  submittedAt: timestamp("submitted_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type MembershipApplication = typeof membershipApplication.$inferSelect;

const membershipApplicationDeclarationsDbSchema = z
  .object({
    naturalPerson: z.literal(true).optional(),
    legalCapacity: z.literal(true).optional(),
    supportsPurpose: z.literal(true).optional(),
    acceptsBylaws: z.literal(true).optional(),
    acceptsFinancialRegulations: z.literal(true).optional(),
    acknowledgesFee: z.literal(true).optional(),
  })
  .nullable();

export function parseDeclarations(
  raw: MembershipApplicationDeclarations | null | undefined,
): MembershipApplicationDeclarations | null {
  const result = membershipApplicationDeclarationsDbSchema.safeParse(
    raw ?? null,
  );
  return result.success ? result.data : null;
}

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
