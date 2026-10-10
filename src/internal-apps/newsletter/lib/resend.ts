import "server-only";

import { Resend } from "resend";
import { env } from "@/env";
import { newId } from "@/lib/id";

/**
 * Thin wrapper around the Resend SDK.
 *
 * Two things live here that are easy to get wrong elsewhere:
 *
 *  1. **The sandbox guard.** `NEWSLETTER_SEND_MODE` defaults to `sandbox`, in
 *     which every dispatching call is intercepted and logged instead of sent.
 *     Read calls always go through — analytics and the contact list are exactly
 *     what you want working while you develop. Going live is a deliberate env
 *     change, never a default.
 *
 *  2. **Error unwrapping.** The SDK returns `{ data, error }` rather than
 *     throwing, which is easy to ignore by accident; a send that silently did
 *     nothing is the worst possible failure here.
 */

export class ResendNotConfiguredError extends Error {
  constructor() {
    super("RESEND_API_KEY is not set.");
    this.name = "ResendNotConfiguredError";
  }
}

export class ResendRequestError extends Error {
  constructor(operation: string, detail: string) {
    super(`Resend ${operation} failed: ${detail}`);
    this.name = "ResendRequestError";
  }
}

let client: Resend | null = null;

export function isResendConfigured(): boolean {
  return !!env.RESEND_API_KEY;
}

function resend(): Resend {
  if (!env.RESEND_API_KEY) throw new ResendNotConfiguredError();
  if (!client) client = new Resend(env.RESEND_API_KEY);
  return client;
}

export type SendMode = "sandbox" | "live";

export function sendMode(): SendMode {
  return env.NEWSLETTER_SEND_MODE;
}

export function isLive(): boolean {
  return sendMode() === "live";
}

function unwrap<T>(
  operation: string,
  result: { data: T | null; error: { message: string } | null },
): T {
  if (result.error) {
    throw new ResendRequestError(operation, result.error.message);
  }
  if (result.data === null) {
    throw new ResendRequestError(operation, "no data returned");
  }
  return result.data;
}

// --- rate limiting ----------------------------------------------------------

/**
 * Resend allows 10 requests per second per account and answers 429 beyond that.
 * Contact assignment still needs one request per contact. Membership reads
 * use the paginated segment endpoint, but other imports or page reads can
 * share the same account limit.
 *
 * Eight leaves headroom for anything else talking to the same account. The
 * window is a plain timestamp list: the check and the push happen with no
 * `await` between them, so the single-threaded event loop makes it atomic.
 * This limit is per process; multiple production instances still share the
 * provider's limit and must respect its rate-limit responses.
 */
const RATE_LIMIT_PER_SECOND = 8;
const RATE_WINDOW_MS = 1000;
const MAX_RETRIES = 4;

const recentRequests: number[] = [];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function throttle(): Promise<void> {
  while (true) {
    const now = Date.now();
    while (recentRequests.length && now - recentRequests[0] > RATE_WINDOW_MS) {
      recentRequests.shift();
    }
    if (recentRequests.length < RATE_LIMIT_PER_SECOND) {
      recentRequests.push(now);
      return;
    }
    await sleep(RATE_WINDOW_MS - (now - recentRequests[0]) + 10);
  }
}

type ProviderError = {
  message: string;
  name?: string;
  statusCode?: number | null;
};

function isRateLimited(error: ProviderError | null): boolean {
  return (
    error?.statusCode === 429 ||
    error?.name === "rate_limit_exceeded" ||
    !!error?.message.toLowerCase().includes("too many requests")
  );
}

/**
 * Every call goes through here: throttled on the way in, retried with backoff
 * if the account is busy anyway.
 */
async function request<T>(
  operation: string,
  send: () => Promise<{ data: T | null; error: ProviderError | null }>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    await throttle();
    const result = await send();

    if (result.error && isRateLimited(result.error) && attempt < MAX_RETRIES) {
      await sleep(2 ** attempt * 250);
      continue;
    }

    return unwrap(operation, result);
  }
}

// --- dispatching (guarded) --------------------------------------------------

export interface CreateBroadcastInput {
  name: string;
  segmentId: string;
  topicId?: string | null;
  from: string;
  replyTo?: string | null;
  subject: string;
  previewText?: string | null;
  html: string;
  text: string;
  /** Omit to send immediately; ISO 8601 to schedule. */
  scheduledAt?: string | null;
}

export interface CreateBroadcastResult {
  broadcastId: string;
  mode: SendMode;
}

export async function createAndSendBroadcast(
  input: CreateBroadcastInput,
  persistBroadcast: (result: CreateBroadcastResult) => Promise<void>,
): Promise<CreateBroadcastResult> {
  if (!isLive()) {
    const fake = `sandbox_${newId("newsletterIssue")}`;
    console.info(
      `[newsletter] sandbox: would create broadcast to segment ${input.segmentId}` +
        ` — subject "${input.subject}", ${Buffer.byteLength(input.html, "utf8")} bytes` +
        (input.scheduledAt
          ? `, scheduled ${input.scheduledAt}`
          : ", immediate"),
    );
    const result = { broadcastId: fake, mode: "sandbox" as const };
    await persistBroadcast(result);
    return result;
  }

  const data = await request("broadcasts.create", () =>
    resend().broadcasts.create({
      name: input.name,
      segmentId: input.segmentId,
      ...(input.topicId ? { topicId: input.topicId } : {}),
      from: input.from,
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      subject: input.subject,
      ...(input.previewText ? { previewText: input.previewText } : {}),
      html: input.html,
      text: input.text,
      send: false,
    }),
  );

  const result = { broadcastId: data.id, mode: "live" as const };
  try {
    // A send must have a durable local reference before Resend can deliver it.
    await persistBroadcast(result);
  } catch (error) {
    try {
      await request("broadcasts.remove", () =>
        resend().broadcasts.remove(data.id),
      );
    } catch (cleanupError) {
      console.error(
        `[newsletter] Could not remove unsent broadcast ${data.id}`,
        cleanupError,
      );
    }
    throw error;
  }
  await request("broadcasts.send", () =>
    resend().broadcasts.send(data.id, {
      ...(input.scheduledAt ? { scheduledAt: input.scheduledAt } : {}),
    }),
  );
  return result;
}

export async function cancelBroadcast(broadcastId: string): Promise<void> {
  if (broadcastId.startsWith("sandbox_")) {
    console.info(`[newsletter] sandbox: would cancel ${broadcastId}`);
    return;
  }
  if (!isLive()) {
    throw new Error("A live broadcast cannot be canceled from sandbox mode.");
  }
  await request("broadcasts.cancel", () =>
    resend().broadcasts.cancel(broadcastId),
  );
}

export interface SendTestInput {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
}

export async function sendTestEmail(input: SendTestInput): Promise<string> {
  if (!isLive()) {
    console.info(
      `[newsletter] sandbox: would send test "${input.subject}" to ${input.to.join(", ")}`,
    );
    return `sandbox_${newId("newsletterIssue")}`;
  }

  const data = await request("emails.send", () =>
    resend().emails.send({
      from: input.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    }),
  );

  return data.id;
}

// --- reads (always live) ----------------------------------------------------

export async function getBroadcast(broadcastId: string) {
  if (broadcastId.startsWith("sandbox_")) return null;
  return await request("broadcasts.get", () =>
    resend().broadcasts.get(broadcastId),
  );
}

export interface BroadcastTotals {
  sent?: number;
  delivered?: number;
  opened?: number;
  unique_opened?: number;
  clicked?: number;
  unique_clicked?: number;
  bounced?: number;
  complained?: number;
  unsubscribed?: number;
  delivery_rate?: number;
  open_rate?: number;
  click_rate?: number;
  bounce_rate?: number;
  complaint_rate?: number;
  unsubscribe_rate?: number;
}

/**
 * Resend keeps engagement out of the broadcast object entirely — `broadcasts.get`
 * returns status and content but no counts. Metrics come from `emails.metrics`.
 *
 * The `broadcast` dimension only produces rows when it is combined with an
 * explicit `broadcastId` filter; asking for the breakdown across the whole
 * account returns an empty set. Filtering by id is therefore not an
 * optimisation, it is the only thing that works — and since the filter takes a
 * list, the entire issue index costs one request rather than one per row.
 */
export async function getBroadcastMetrics(
  broadcastIds: string[],
  { startDate, endDate }: { startDate: string; endDate: string },
): Promise<Map<string, BroadcastTotals>> {
  const real = broadcastIds.filter((id) => !id.startsWith("sandbox_"));
  const out = new Map<string, BroadcastTotals>();
  if (!real.length) return out;

  const data = await request("emails.metrics", () =>
    resend().emails.metrics({
      broadcastId: real,
      dimensions: ["broadcast"],
      startDate,
      endDate,
    }),
  );

  for (const row of data.data ?? []) {
    if (row.broadcast_id) out.set(row.broadcast_id, row as BroadcastTotals);
  }

  return out;
}

export async function getSingleBroadcastMetrics(
  broadcastId: string,
  range: { startDate: string; endDate: string },
): Promise<BroadcastTotals | null> {
  const map = await getBroadcastMetrics([broadcastId], range);
  return map.get(broadcastId) ?? null;
}

export interface ClickedLink {
  url: string;
  clicks: number;
  unique_clicks: number;
}

export async function getClickedLinks(
  broadcastId: string,
): Promise<ClickedLink[]> {
  if (broadcastId.startsWith("sandbox_")) return [];
  const links: ClickedLink[] = [];
  let after: string | undefined;
  for (let page = 0; page < 60; page++) {
    const data = await request("broadcasts.clickedLinks", () =>
      resend().broadcasts.clickedLinks(broadcastId, {
        limit: 100,
        ...(after ? { after } : {}),
      }),
    );
    links.push(...data.data);
    if (!data.has_more) return links;
    const cursor = data.data.at(-1)?.id;
    if (!cursor || cursor === after) {
      throw new ResendRequestError(
        "broadcasts.clickedLinks",
        "incomplete pagination response",
      );
    }
    after = cursor;
  }
  throw new ResendRequestError(
    "broadcasts.clickedLinks",
    "clicked link list exceeds the page limit",
  );
}

export type RecipientEventType =
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "unsubscribed"
  | "suppressed";

export async function getRecipients(
  broadcastId: string,
  type: RecipientEventType,
  limit = 25,
) {
  if (broadcastId.startsWith("sandbox_")) return [];

  const data = await request("broadcasts.recipients", () =>
    resend().broadcasts.recipients(broadcastId, { type, limit }),
  );

  return data.data ?? [];
}

export interface RemoteContact {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  unsubscribed: boolean;
  createdAt: string | null;
}

/**
 * Walks a complete contact list. The SDK's segmentId option uses
 * /segments/:id/contacts; a hand-built /contacts?segment_id= URL does not filter.
 */
export async function listAllContacts({
  segmentId,
  maxPages = 60,
}: {
  segmentId?: string;
  maxPages?: number;
} = {}): Promise<RemoteContact[]> {
  const out: RemoteContact[] = [];
  const seen = new Set<string>();
  let after: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const data = await request("contacts.list", () =>
      resend().contacts.list({
        limit: 100,
        ...(segmentId ? { segmentId } : {}),
        ...(after ? { after } : {}),
      }),
    );

    if (!Array.isArray(data.data) || typeof data.has_more !== "boolean") {
      throw new ResendRequestError(
        "contacts.list",
        "incomplete pagination response",
      );
    }
    const rows = data.data;

    if (!rows.length) {
      if (data.has_more)
        throw new ResendRequestError(
          "contacts.list",
          "incomplete pagination response",
        );
      return out;
    }

    for (const row of rows) {
      if (
        !row.id ||
        typeof row.email !== "string" ||
        typeof row.unsubscribed !== "boolean" ||
        seen.has(row.id)
      ) {
        throw new ResendRequestError(
          "contacts.list",
          "incomplete or duplicate contact response",
        );
      }
      seen.add(row.id);
      out.push({
        id: row.id,
        email: row.email,
        firstName: row.first_name ?? null,
        lastName: row.last_name ?? null,
        unsubscribed: row.unsubscribed,
        createdAt: row.created_at ?? null,
      });
    }

    if (!data.has_more) return out;
    const cursor = rows[rows.length - 1]?.id;
    if (!cursor || cursor === after)
      throw new ResendRequestError(
        "contacts.list",
        "missing pagination cursor",
      );
    after = cursor;
  }

  throw new ResendRequestError(
    "contacts.list",
    "contact list exceeds the sync page limit; no changes were applied",
  );
}

export async function addContactToSegment(
  contactId: string,
  segmentId: string,
): Promise<void> {
  if (!isLive()) {
    console.info(
      `[newsletter] sandbox: would add contact ${contactId} to segment ${segmentId}`,
    );
    return;
  }
  await request("contacts.segments.add", () =>
    resend().contacts.segments.add({ contactId, segmentId }),
  );
}

export async function listSegments() {
  const data = await request("segments.list", () =>
    resend().segments.list({ limit: 100 }),
  );
  if (!Array.isArray(data.data) || typeof data.has_more !== "boolean") {
    throw new ResendRequestError(
      "segments.list",
      "incomplete pagination response",
    );
  }
  if (data.has_more)
    throw new ResendRequestError(
      "segments.list",
      "segment list exceeds the sync limit; no changes were applied",
    );
  return data.data ?? [];
}

export async function listTopics() {
  const data = await request("topics.list", () => resend().topics.list());
  return data.data ?? [];
}

export async function listDomains() {
  const data = await request("domains.list", () => resend().domains.list());
  return data.data ?? [];
}

export interface RemoteBroadcast {
  id: string;
  name: string | null;
  status: string;
  segmentId: string | null;
  createdAt: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
}

/**
 * Every broadcast on the account, not only the ones this app created.
 *
 * Analytics reads from here rather than from the local issue table so the
 * history that predates this app — and anything sent straight from the Resend
 * dashboard — still shows up.
 */
export async function listBroadcasts(): Promise<RemoteBroadcast[]> {
  const broadcasts: RemoteBroadcast[] = [];
  let after: string | undefined;
  for (let page = 0; page < 60; page++) {
    const data = await request("broadcasts.list", () =>
      resend().broadcasts.list({ limit: 100, ...(after ? { after } : {}) }),
    );
    broadcasts.push(
      ...data.data.map((row) => ({
        id: row.id,
        name: row.name ?? null,
        status: row.status,
        segmentId: row.segment_id ?? null,
        createdAt: row.created_at ?? null,
        scheduledAt: row.scheduled_at ?? null,
        sentAt: row.sent_at ?? null,
      })),
    );
    if (!data.has_more) return broadcasts;
    const cursor = data.data.at(-1)?.id;
    if (!cursor || cursor === after) {
      throw new ResendRequestError(
        "broadcasts.list",
        "incomplete pagination response",
      );
    }
    after = cursor;
  }
  throw new ResendRequestError(
    "broadcasts.list",
    "broadcast list exceeds the page limit",
  );
}

export interface DomainTracking {
  name: string;
  status: string;
  openTracking: boolean;
  clickTracking: boolean;
  trackingHost: string | null;
  trackingStatus: string | null;
}

/**
 * Whether the sending domain records opens and clicks.
 *
 * Expose both switches and DNS verification. Enabled tracking without a
 * verified tracking host must not be presented as fully configured.
 */
export async function getDomainTracking(): Promise<DomainTracking[]> {
  const domains = (await listDomains()) as unknown as {
    id: string;
    name: string;
    status: string;
    open_tracking?: boolean;
    click_tracking?: boolean;
  }[];

  return Promise.all(
    domains.map(async (domain) => {
      const detail = await request("domains.get", () =>
        resend().domains.get(domain.id),
      );
      const trackingHost = detail.tracking_subdomain
        ? `${detail.tracking_subdomain}.${domain.name}`
        : null;
      const tracking = detail.records.find(
        (record) =>
          record.record === "Tracking" &&
          record.name.startsWith(`${detail.tracking_subdomain}.`),
      );
      return {
        name: domain.name,
        status: detail.status,
        openTracking: !!detail.open_tracking,
        clickTracking: !!detail.click_tracking,
        trackingHost,
        trackingStatus: tracking?.status ?? null,
      };
    }),
  );
}

export interface ContactImportResult {
  id: string;
}

/**
 * Bulk-imports contacts from a CSV.
 *
 * The one-by-one path would be one request per person against a 10/second
 * limit; this hands Resend the whole list and lets it do the work, with segment
 * and topic assignment applied as part of the same operation so an imported
 * contact is never left in the limbo of "exists but belongs to nothing".
 */
export async function importContactsCsv({
  csv,
  filename,
  segmentId,
  topicId,
}: {
  csv: string;
  filename: string;
  segmentId?: string | null;
  topicId?: string | null;
}): Promise<ContactImportResult> {
  if (!isLive()) {
    const rows = Math.max(0, csv.split("\n").length - 1);
    console.info(
      `[newsletter] sandbox: would import ${rows} contacts from ${filename}` +
        (segmentId ? ` into segment ${segmentId}` : ""),
    );
    return { id: `sandbox_${newId("newsletterContact")}` };
  }

  const file = new File([csv], filename, { type: "text/csv" });

  const data = await request("contacts.imports.create", () =>
    resend().contacts.imports.create({
      file,
      columnMap: {
        email: "email",
        firstName: "first_name",
        lastName: "last_name",
        properties: {
          source: { column: "source", type: "string" },
          member_status: { column: "member_status", type: "string" },
          department: { column: "department", type: "string" },
          batch_number: { column: "batch_number", type: "string" },
        },
      },
      // Never downgrade someone who is already subscribed on the basis of a
      // fresh import: existing preferences win.
      onConflict: "skip",
      ...(segmentId ? { segments: [{ id: segmentId }] } : {}),
      ...(topicId
        ? { topics: [{ id: topicId, subscription: "opt_in" as const }] }
        : {}),
    }),
  );

  return { id: data.id };
}
