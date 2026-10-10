import { desc, sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { z } from "zod";
import { user } from "@/db/schema/auth";
import { type Block, blocksSchema } from "../../lib/blocks";

/**
 * Tables owned by the newsletter app.
 *
 * Conventions for app schemas:
 *  - Table names and enum names are prefixed `newsletter_` — everything shares
 *    one Postgres schema and one enum namespace, so the prefix is what prevents
 *    collisions between apps.
 *  - Import core tables (`user`, ...) from their defining file, never from
 *    `@/db/schema`, to avoid cycles.
 *  - These tables are deliberately NOT added to the aggregate `schema` object in
 *    `src/db/schema/index.ts`, which is shared with the Better Auth adapter.
 *    That means no `db.query.*` relational API here; use the core query builder
 *    with explicit joins.
 */

/**
 * Local copy of the membership domain's jsonb helper (see
 * `src/db/schema/legal-membership.ts`). Duplicated rather than hoisted so the
 * app stays self-contained and deleting it stays a one-directory job.
 */
function validatedJsonb<T>(schema: z.ZodType<T>) {
  return customType<{ data: T; driverData: unknown }>({
    dataType() {
      return "jsonb";
    },
    fromDriver(val: unknown): T {
      return schema.parse(val);
    },
    toDriver(val: T): string {
      return JSON.stringify(val);
    },
  });
}

/**
 * Our own lifecycle, which is deliberately narrower than Resend's. Resend knows
 * `draft | queued | scheduled | sent | canceled`; we add `sending` (queued at
 * Resend but not finished) and `failed` (the create call itself errored, so
 * there is no broadcast to poll).
 */
export const newsletterIssueStatus = pgEnum("newsletter_issue_status", [
  "draft",
  "scheduled",
  "sending",
  "sent",
  "canceled",
  "failed",
]);
export type NewsletterIssueStatus =
  (typeof newsletterIssueStatus.enumValues)[number];

/** Which side of the sandbox guard an issue was dispatched through. */
export const newsletterSendMode = pgEnum("newsletter_send_mode", [
  "sandbox",
  "live",
]);

export const newsletterAssetDriver = pgEnum("newsletter_asset_driver", [
  "local",
  "blob",
]);

export const newsletterIssue = pgTable(
  "newsletter_issue",
  {
    id: text("id").primaryKey(),
    /** Internal working name. The subject is what recipients see. */
    name: text("name").notNull(),
    subject: text("subject").notNull().default(""),
    previewText: text("preview_text").notNull().default(""),
    blocks: validatedJsonb(blocksSchema)("blocks")
      .notNull()
      .$type<Block[]>()
      .default(sql`'[]'::jsonb`),
    status: newsletterIssueStatus("status").notNull().default("draft"),

    // Resolved at send time from env defaults, but stored per issue so a sent
    // issue keeps a faithful record of where it actually went.
    fromAddress: text("from_address"),
    replyTo: text("reply_to"),
    segmentId: text("segment_id"),
    topicId: text("topic_id"),

    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),

    resendBroadcastId: text("resend_broadcast_id"),
    sendMode: newsletterSendMode("send_mode"),
    /** A lease for a process that has claimed a draft but not recorded Resend. */
    dispatchStartedAt: timestamp("dispatch_started_at", { withTimezone: true }),
    /** Populated when status is `failed`, so the UI can say why. */
    lastError: text("last_error"),

    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // The issue list reads newest first; the status filter narrows it.
    index("newsletter_issue_status_idx").on(
      table.status,
      desc(table.createdAt),
    ),
    index("newsletter_issue_created_at_idx").on(desc(table.createdAt)),
    // One local issue per Resend broadcast, so status polling can map back
    // unambiguously. Partial: drafts have no broadcast yet.
    uniqueIndex("newsletter_issue_broadcast_idx")
      .on(table.resendBroadcastId)
      .where(sql`${table.resendBroadcastId} is not null`),
  ],
);

export const newsletterAsset = pgTable(
  "newsletter_asset",
  {
    id: text("id").primaryKey(),
    /** Absolute or app-relative URL that an email client can load. */
    url: text("url").notNull(),
    /** Storage key, needed to delete the underlying object later. */
    pathname: text("pathname").notNull(),
    driver: newsletterAssetDriver("driver").notNull(),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    width: integer("width"),
    height: integer("height"),
    alt: text("alt").notNull().default(""),
    uploadedBy: text("uploaded_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("newsletter_asset_created_at_idx").on(desc(table.createdAt)),
  ],
);

/** Expiring, per-tab presence. It never changes the draft's saved revision. */
export const newsletterIssueEditor = pgTable(
  "newsletter_issue_editor",
  {
    issueId: text("issue_id")
      .notNull()
      .references(() => newsletterIssue.id, { onDelete: "cascade" }),
    editorSessionId: uuid("editor_session_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.issueId, table.editorSessionId] }),
    index("newsletter_issue_editor_expiry_idx").on(table.lastSeenAt),
  ],
);
/**
 * Read-only mirror of Resend's contacts. Resend stays the source of truth for
 * consent and topic preferences; this table exists so the audience screen can
 * search and paginate without hammering the API, and so an import can diff
 * against what already exists.
 */
export const newsletterContact = pgTable(
  "newsletter_contact",
  {
    id: text("id").primaryKey(),
    resendContactId: text("resend_contact_id").notNull(),
    email: text("email").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    unsubscribed: boolean("unsubscribed").notNull().default(false),
    /** Topic subscription state as reported by Resend, keyed by topic id. */
    topics: jsonb("topics"),
    /**
     * Segment ids this contact belongs to.
     *
     * Mirrored so page renders do not paginate every remote segment. The
     * explicit refresh reads /segments/:id/contacts and only replaces these
     * memberships after every page has loaded successfully.
     */
    segments: jsonb("segments").$type<string[]>(),
    properties: jsonb("properties"),
    resendCreatedAt: timestamp("resend_created_at", { withTimezone: true }),
    syncedAt: timestamp("synced_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("newsletter_contact_resend_id_idx").on(table.resendContactId),
    uniqueIndex("newsletter_contact_email_idx").on(table.email),
    index("newsletter_contact_unsubscribed_idx").on(table.unsubscribed),
  ],
);
