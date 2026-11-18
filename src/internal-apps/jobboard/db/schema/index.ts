import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "@/db/schema/auth";
import type {
  ContactInput,
  JobContent,
  MetricEvent,
  PublicJob,
  SubmissionInput,
} from "../../lib/contracts";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

/** App-owned tables intentionally stay outside the Better Auth schema aggregate. */
export const jobboardCompany = pgTable(
  "jobboard_company",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    website: text("website").notNull(),
    description: text("description").notNull().default(""),
    contacts: jsonb("contacts").$type<ContactInput[]>().notNull().default([]),
    notes: text("notes").notNull().default(""),
    terms: text("terms").notNull().default(""),
    ...timestamps,
  },
  (table) => [index("jobboard_company_name_idx").on(table.name)],
);

export type JobStatus = "draft" | "published" | "paused" | "closed" | "expired";
export const jobboardJob = pgTable(
  "jobboard_job",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => jobboardCompany.id, { onDelete: "restrict" }),
    content: jsonb("content").$type<JobContent>().notNull(),
    notes: text("notes").notNull().default(""),
    status: text("status").$type<JobStatus>().notNull().default("draft"),
    draftVersion: integer("draft_version").notNull().default(1),
    publishedDraftVersion: integer("published_draft_version"),
    published: jsonb("published").$type<PublicJob>(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    index("jobboard_job_company_idx").on(table.companyId),
    index("jobboard_job_publication_idx").on(
      table.status,
      table.expiresAt,
      table.id,
    ),
    check(
      "jobboard_job_status_check",
      sql`${table.status} in ('draft', 'published', 'paused', 'closed', 'expired')`,
    ),
  ],
);

/** Append-only copies preserve exactly what the editor approved, including company details. */
export const jobboardRevision = pgTable(
  "jobboard_revision",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobboardJob.id, { onDelete: "restrict" }),
    snapshot: jsonb("snapshot").$type<PublicJob>().notNull(),
    reviewNotes: text("review_notes").notNull(),
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    actorName: text("actor_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("jobboard_revision_job_idx").on(table.jobId, table.createdAt),
  ],
);

export const jobboardSubmission = pgTable(
  "jobboard_submission",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id").notNull().unique(),
    payloadHash: text("payload_hash").notNull(),
    payload: jsonb("payload").$type<SubmissionInput>().notNull(),
    status: text("status")
      .$type<"pending_review" | "accepted" | "rejected">()
      .notNull()
      .default("pending_review"),
    jobId: text("job_id").references(() => jobboardJob.id, {
      onDelete: "restrict",
    }),
    reviewNote: text("review_note").notNull().default(""),
    ...timestamps,
  },
  (table) => [
    index("jobboard_submission_queue_idx").on(table.status, table.createdAt),
    check(
      "jobboard_submission_status_check",
      sql`${table.status} in ('pending_review', 'accepted', 'rejected')`,
    ),
  ],
);

export const jobboardSubmissionNotification = pgTable(
  "jobboard_submission_notification",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    submissionId: text("submission_id")
      .notNull()
      .references(() => jobboardSubmission.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.submissionId] }),
    index("jobboard_notification_inbox_idx").on(
      table.userId,
      table.createdAt,
      table.submissionId,
    ),
    index("jobboard_notification_unread_idx")
      .on(table.userId)
      .where(sql`${table.readAt} IS NULL`),
  ],
);

export const jobboardAudit = pgTable(
  "jobboard_audit",
  {
    id: text("id").primaryKey(),
    entityId: text("entity_id").notNull(),
    eventType: text("event_type").notNull(),
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    actorName: text("actor_name").notNull(),
    description: text("description").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("jobboard_audit_entity_idx").on(table.entityId, table.createdAt),
  ],
);

/** Transport IDs only: no visitor identifiers, IPs, referrers, or raw events. */
export const jobboardMetricReceipt = pgTable(
  "jobboard_metric_receipt",
  {
    eventId: text("event_id").primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("jobboard_metric_receipt_retention_idx").on(table.createdAt),
  ],
);

export const jobboardMetricDaily = pgTable(
  "jobboard_metric_daily",
  {
    day: date("day").notNull(),
    // Empty string is the board-level bucket, which avoids NULL uniqueness semantics.
    jobId: text("job_id").notNull().default(""),
    type: text("type").$type<MetricEvent["type"]>().notNull(),
    surface: text("surface").$type<MetricEvent["surface"]>().notNull(),
    source: text("source").$type<MetricEvent["source"]>().notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [
    primaryKey({
      columns: [
        table.day,
        table.jobId,
        table.type,
        table.surface,
        table.source,
      ],
    }),
    check("jobboard_metric_daily_count_check", sql`${table.count} >= 0`),
  ],
);

/** Per-service fixed windows bound writes across server instances without visitor identity. */
export const jobboardServiceWindow = pgTable(
  "jobboard_service_window",
  {
    scope: text("scope").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull(),
  },
  (table) => [
    uniqueIndex("jobboard_service_window_unique").on(
      table.scope,
      table.windowStart,
    ),
  ],
);
