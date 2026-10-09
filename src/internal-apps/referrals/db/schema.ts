import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "@/db/schema/auth";
import { batch } from "@/db/schema/batch";

export const attributionStatuses = [
  "matched",
  "missing_code",
  "unknown_code",
  "wrong_campaign",
  "outside_window",
  "invalid_fields",
] as const;
export type AttributionStatus = (typeof attributionStatuses)[number];

export const referralsCampaign = pgTable(
  "referrals_campaign",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    batchNumber: integer("batch_number").references(() => batch.number),
    formId: text("form_id").notNull(),
    applicationUrl: text("application_url").notNull(),
    refFieldKey: text("ref_field_key").notNull(),
    campaignFieldKey: text("campaign_field_key").notNull(),
    opensAt: timestamp("opens_at", { withTimezone: true }).notNull(),
    closesAt: timestamp("closes_at", { withTimezone: true }).notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("referrals_campaign_form_unique").on(table.formId),
    check(
      "referrals_campaign_window_check",
      sql`${table.closesAt} > ${table.opensAt}`,
    ),
    check(
      "referrals_campaign_keys_check",
      sql`${table.refFieldKey} <> ${table.campaignFieldKey}`,
    ),
  ],
);

export const referralsLink = pgTable(
  "referrals_link",
  {
    id: text("id").primaryKey(),
    // Preserve the code after deletion so it can never be reassigned.
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    code: text("code").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("referrals_link_user_unique").on(table.userId),
    uniqueIndex("referrals_link_code_unique").on(table.code),
  ],
);

export const referralsSubmission = pgTable(
  "referrals_submission",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => referralsCampaign.id),
    linkId: text("link_id").references(() => referralsLink.id),
    formId: text("form_id").notNull(),
    submissionId: text("submission_id").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull(),
    status: text("status").$type<AttributionStatus>().notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("referrals_submission_form_submission_unique").on(
      table.formId,
      table.submissionId,
    ),
    index("referrals_submission_link_campaign_idx").on(
      table.linkId,
      table.campaignId,
    ),
    index("referrals_submission_campaign_status_idx").on(
      table.campaignId,
      table.status,
    ),
    check(
      "referrals_submission_status_check",
      sql`${table.status} in ('matched', 'missing_code', 'unknown_code', 'wrong_campaign', 'outside_window', 'invalid_fields')`,
    ),
    check(
      "referrals_submission_link_check",
      sql`(${table.status} = 'matched') = (${table.linkId} is not null)`,
    ),
  ],
);
