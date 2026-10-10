import "server-only";

import { count, desc, eq, ilike, max, or, type SQL, sql } from "drizzle-orm";
import db from "@/db";
import { user } from "@/db/schema/auth";
import type { Block } from "../lib/blocks";
import {
  type NewsletterIssueStatus,
  newsletterContact,
  newsletterIssue,
} from "./schema";

/**
 * Reads for the newsletter app.
 *
 * App tables are not part of the aggregate `schema` object (it is shared with
 * the Better Auth adapter), so there is no `db.query.*` relational API here —
 * joins are written out explicitly.
 */

export interface IssueListItem {
  id: string;
  name: string;
  subject: string;
  status: NewsletterIssueStatus;
  scheduledAt: Date | null;
  sentAt: Date | null;
  resendBroadcastId: string | null;
  blockCount: number;
  authorName: string | null;
  updatedAt: Date;
}

export interface IssueDetail {
  id: string;
  name: string;
  subject: string;
  previewText: string;
  blocks: Block[];
  status: NewsletterIssueStatus;
  fromAddress: string | null;
  replyTo: string | null;
  segmentId: string | null;
  topicId: string | null;
  scheduledAt: Date | null;
  sentAt: Date | null;
  resendBroadcastId: string | null;
  lastError: string | null;
  updatedAt: Date;
}

/** The list view is one screen; issues accumulate roughly twelve a year. */
const MAX_ISSUES = 200;

export async function listIssues(): Promise<IssueListItem[]> {
  const rows = await db
    .select({
      id: newsletterIssue.id,
      name: newsletterIssue.name,
      subject: newsletterIssue.subject,
      status: newsletterIssue.status,
      blockCount: sql<number>`jsonb_array_length(${newsletterIssue.blocks})`,
      scheduledAt: newsletterIssue.scheduledAt,
      sentAt: newsletterIssue.sentAt,
      resendBroadcastId: newsletterIssue.resendBroadcastId,
      updatedAt: newsletterIssue.updatedAt,
      authorFirstName: user.firstName,
      authorLastName: user.lastName,
    })
    .from(newsletterIssue)
    .leftJoin(user, eq(newsletterIssue.createdBy, user.id))
    .orderBy(desc(newsletterIssue.createdAt))
    .limit(MAX_ISSUES);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    subject: row.subject,
    status: row.status,
    scheduledAt: row.scheduledAt,
    sentAt: row.sentAt,
    resendBroadcastId: row.resendBroadcastId,
    blockCount: row.blockCount,
    authorName:
      row.authorFirstName && row.authorLastName
        ? `${row.authorFirstName} ${row.authorLastName}`
        : null,
    updatedAt: row.updatedAt,
  }));
}

export async function getIssue(id: string): Promise<IssueDetail | null> {
  const [row] = await db
    .select({
      id: newsletterIssue.id,
      name: newsletterIssue.name,
      subject: newsletterIssue.subject,
      previewText: newsletterIssue.previewText,
      blocks: newsletterIssue.blocks,
      status: newsletterIssue.status,
      fromAddress: newsletterIssue.fromAddress,
      replyTo: newsletterIssue.replyTo,
      segmentId: newsletterIssue.segmentId,
      topicId: newsletterIssue.topicId,
      scheduledAt: newsletterIssue.scheduledAt,
      sentAt: newsletterIssue.sentAt,
      resendBroadcastId: newsletterIssue.resendBroadcastId,
      lastError: newsletterIssue.lastError,
      updatedAt: newsletterIssue.updatedAt,
    })
    .from(newsletterIssue)
    .where(eq(newsletterIssue.id, id))
    .limit(1);

  return row ?? null;
}

export interface ContactRow {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  unsubscribed: boolean;
  resendCreatedAt: Date | null;
}

export interface ContactPage {
  rows: ContactRow[];
  total: number;
  pageCount: number;
  currentPage: number;
}

const CONTACTS_PAGE_SIZE = 50;

export async function listContacts({
  page = 1,
  search = "",
}: {
  page?: number;
  search?: string;
}): Promise<ContactPage> {
  const term = search.trim();
  const where: SQL | undefined = term
    ? or(
        ilike(newsletterContact.email, `%${term}%`),
        ilike(newsletterContact.firstName, `%${term}%`),
        ilike(newsletterContact.lastName, `%${term}%`),
      )
    : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(newsletterContact)
    .where(where);

  const pageCount = Math.max(1, Math.ceil(total / CONTACTS_PAGE_SIZE));
  const safePage = Math.min(
    Math.max(1, Number.isFinite(page) ? Math.trunc(page) : 1),
    pageCount,
  );

  const rows = await db
    .select({
      id: newsletterContact.id,
      email: newsletterContact.email,
      firstName: newsletterContact.firstName,
      lastName: newsletterContact.lastName,
      unsubscribed: newsletterContact.unsubscribed,
      resendCreatedAt: newsletterContact.resendCreatedAt,
    })
    .from(newsletterContact)
    .where(where)
    .orderBy(
      desc(newsletterContact.resendCreatedAt),
      desc(newsletterContact.id),
    )
    .limit(CONTACTS_PAGE_SIZE)
    .offset((safePage - 1) * CONTACTS_PAGE_SIZE);

  return { rows, total, pageCount, currentPage: safePage };
}

export async function getContactStats(): Promise<{
  total: number;
  unsubscribed: number;
  lastSyncedAt: Date | null;
}> {
  const [stats] = await db
    .select({
      total: count(),
      unsubscribed: sql<number>`count(*) filter (where ${newsletterContact.unsubscribed})::int`,
      lastSyncedAt: max(newsletterContact.syncedAt),
    })
    .from(newsletterContact);
  return stats;
}

/**
 * How many mirrored contacts belong to each segment.
 *
 * Counted locally so page renders do not page through every remote segment.
 * The number is as fresh as the last "Refresh segment membership" run, which the
 * Audience page states explicitly rather than implying live data.
 */
export async function getSegmentMemberCounts(): Promise<Map<string, number>> {
  const rows = await db
    .select({
      segmentId: sql<string>`segment.value`,
      total: sql<number>`count(distinct ${newsletterContact.id})::int`,
    })
    .from(newsletterContact)
    .crossJoin(
      sql`lateral jsonb_array_elements_text(coalesce(${newsletterContact.segments}, '[]'::jsonb)) as segment(value)`,
    )
    .where(eq(newsletterContact.unsubscribed, false))
    .groupBy(sql`segment.value`);

  return new Map(rows.map((row) => [row.segmentId, row.total]));
}
