import { createHash } from "node:crypto";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  lt,
  lte,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { z } from "zod";
import { newId } from "@/lib/id";
import {
  type JobContent,
  jobContentSchema,
  type MetricEvent,
  metricsInputSchema,
  type PublicJob,
  type PublishInput,
  publicCompanySchema,
  publicJobSchema,
  publishInputSchema,
  type SubmissionInput,
  submissionInputSchema,
} from "../lib/contracts";
import {
  type SaveCompanyInput,
  type SaveJobInput,
  saveCompanySchema,
  saveJobSchema,
} from "../lib/editor-schemas";
import { type EditJobExpiryInput, editJobExpirySchema } from "../lib/expiry";
import {
  type JobListQuery,
  type ListQuery,
  MANAGEMENT_PAGE_SIZE,
  type SubmissionListQuery,
} from "../lib/list-params";
import { queueSubmissionNotifications } from "./notifications";
import {
  type JobStatus,
  jobboardAudit,
  jobboardCompany,
  jobboardJob,
  jobboardMetricDaily,
  jobboardMetricReceipt,
  jobboardRevision,
  jobboardServiceWindow,
  jobboardSubmission,
} from "./schema";

export class JobboardError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "JobboardError";
  }
}

export type JobboardActor = { id: string | null; name: string };
export type { SaveCompanyInput, SaveJobInput } from "../lib/editor-schemas";
export type JobboardCompany = typeof jobboardCompany.$inferSelect;
export type JobboardSubmission = typeof jobboardSubmission.$inferSelect;
export type JobboardJob = typeof jobboardJob.$inferSelect & {
  title: string;
  companyName: string;
  hasUnpublishedChanges: boolean;
  reviewToken: string;
};

export type MetricTotals = {
  boardRequests: number;
  widgetRequests: number;
  jobViews: number;
  applyClicks: number;
  shareClicks: number;
};
const emptyTotals = (): MetricTotals => ({
  boardRequests: 0,
  widgetRequests: 0,
  jobViews: 0,
  applyClicks: 0,
  shareClicks: 0,
});
const metricProperty: Record<MetricEvent["type"], keyof MetricTotals> = {
  board_request: "boardRequests",
  widget_request: "widgetRequests",
  detail_request: "jobViews",
  apply_redirect: "applyClicks",
  share_redirect: "shareClicks",
};
const MAX_LISTING_DAYS = 365;
const DAY_MS = 86_400_000;

function requireRow<T>(row: T | undefined, label: string): T {
  if (!row) throw new JobboardError("not_found", `${label} not found.`, 404);
  return row;
}

export function effectiveJobStatus(
  status: JobStatus,
  expiresAt: Date | null,
  now: Date,
): JobStatus {
  return status === "published" && (!expiresAt || expiresAt <= now)
    ? "expired"
    : status;
}

export function aggregateRetentionCutoff(now: Date): string {
  const cutoff = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 13, 1),
  );
  const lastDay = new Date(
    Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0),
  ).getUTCDate();
  cutoff.setUTCDate(Math.min(now.getUTCDate(), lastDay));
  return cutoff.toISOString().slice(0, 10);
}

/** A fresh, explicit public projection never joins live company or private contact data. */
export function publicSnapshot(
  row: Pick<
    typeof jobboardJob.$inferSelect,
    "published" | "status" | "expiresAt"
  >,
  now: Date,
): PublicJob | null {
  const snapshot = row.published;
  if (!snapshot) return null;
  return publicJobSchema.parse({
    id: snapshot.id,
    slug: snapshot.slug,
    content: snapshot.content,
    company: {
      id: snapshot.company.id,
      name: snapshot.company.name,
      website: snapshot.company.website,
      description: snapshot.company.description,
    },
    publishedAt: snapshot.publishedAt,
    expiresAt: snapshot.expiresAt,
    status:
      effectiveJobStatus(row.status, row.expiresAt, now) === "published"
        ? "active"
        : "closed",
  });
}

function jobSlug(title: string, id: string) {
  const label = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100)
    .replace(/-$/, "");
  return `${label || "position"}-${id.replace(/[^a-z0-9]/gi, "").toLowerCase()}`;
}

function reviewTokenFor(
  job: typeof jobboardJob.$inferSelect,
  company: JobboardCompany,
) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        jobId: job.id,
        draftVersion: job.draftVersion,
        publication: {
          status: job.status,
          publishedAt: job.publishedAt,
          expiresAt: job.expiresAt,
        },
        company: {
          id: company.id,
          name: company.name,
          website: company.website,
          description: company.description,
        },
      }),
    )
    .digest("hex");
}

/** Dependencies are supplied explicitly so DB tests cannot accidentally import production env. */
export function createJobboardService<TSchema extends Record<string, unknown>>(
  db: NodePgDatabase<TSchema>,
  clock: () => Date = () => new Date(),
) {
  const audit = async (
    tx: Pick<typeof db, "insert">,
    entityId: string,
    eventType: string,
    description: string,
    actor: JobboardActor,
  ) => {
    await tx.insert(jobboardAudit).values({
      id: newId("jobboardAudit"),
      entityId,
      eventType,
      description,
      actorId: actor.id,
      actorName: actor.name,
      createdAt: clock(),
    });
  };
  const companyById = async (
    tx: Pick<typeof db, "select">,
    id: string,
    lock?: "share" | "update",
  ) => {
    const query = tx
      .select()
      .from(jobboardCompany)
      .where(eq(jobboardCompany.id, id))
      .limit(1);
    return requireRow((await (lock ? query.for(lock) : query))[0], "Company");
  };
  const lockJob = async (tx: Pick<typeof db, "select">, id: string) =>
    requireRow(
      (
        await tx
          .select()
          .from(jobboardJob)
          .where(eq(jobboardJob.id, id))
          .for("update")
          .limit(1)
      )[0],
      "Job",
    );
  const jobById = async (
    tx: Pick<typeof db, "select">,
    id: string,
  ): Promise<JobboardJob> => {
    const row = requireRow(
      (
        await tx
          .select({ job: jobboardJob, company: jobboardCompany })
          .from(jobboardJob)
          .innerJoin(
            jobboardCompany,
            eq(jobboardCompany.id, jobboardJob.companyId),
          )
          .where(eq(jobboardJob.id, id))
          .limit(1)
      )[0],
      "Job",
    );
    return toJob(row.job, row.company);
  };
  const toJob = (
    row: typeof jobboardJob.$inferSelect,
    company: JobboardCompany,
  ): JobboardJob => ({
    ...row,
    title: row.content.title,
    companyName: company.name,
    status: effectiveJobStatus(row.status, row.expiresAt, clock()),
    published: publicSnapshot(row, clock()),
    hasUnpublishedChanges:
      row.published !== null &&
      (row.draftVersion !== row.publishedDraftVersion ||
        row.published.company.id !== company.id ||
        row.published.company.name !== company.name ||
        row.published.company.website !== company.website ||
        row.published.company.description !== company.description),
    reviewToken: reviewTokenFor(row, company),
  });

  function pageBounds(requested: number, matched: number) {
    const pageCount = Math.max(1, Math.ceil(matched / MANAGEMENT_PAGE_SIZE));
    const page = Math.min(
      Math.max(1, Number.isSafeInteger(requested) ? requested : 1),
      pageCount,
    );
    return { page, pageCount, matched };
  }
  function containsText(expression: SQL, q: string) {
    return q.trim()
      ? sql`strpos(lower(${expression}), lower(${q.trim()})) > 0`
      : undefined;
  }
  // Stored company websites use HTTP(S). Exclude scheme, port and path from host matching.
  const companyHost = sql`lower(substring(regexp_replace(${jobboardCompany.website}, '^https?:/*(www[.])?', '', 'i') from '^[^/:?#]+'))`;
  function statusTotals<T extends string>(
    rows: { status: T; total: number; matching: number }[],
    selected: T | "all",
  ) {
    const counts: Record<string, number> = {};
    let total = 0;
    let matched = 0;
    for (const row of rows) {
      counts[row.status] = row.total;
      total += row.total;
      if (selected === "all" || selected === row.status)
        matched += row.matching;
    }
    return { counts, total, matched };
  }
  function countMatching(search: SQL | undefined) {
    return search
      ? sql<number>`count(*) filter (where ${search})`.mapWith(Number)
      : count();
  }
  async function listCompanies() {
    return db
      .select()
      .from(jobboardCompany)
      .orderBy(asc(jobboardCompany.name), asc(jobboardCompany.id));
  }
  async function listCompanyOptions(q = "", selectedId?: string) {
    const matches = containsText(sql`${jobboardCompany.name}`, q);
    return db
      .select({
        id: jobboardCompany.id,
        name: jobboardCompany.name,
        website: jobboardCompany.website,
        description: jobboardCompany.description,
      })
      .from(jobboardCompany)
      .where(
        matches && selectedId
          ? or(matches, eq(jobboardCompany.id, selectedId))
          : matches,
      )
      .orderBy(
        ...(selectedId ? [desc(eq(jobboardCompany.id, selectedId))] : []),
        asc(jobboardCompany.name),
        asc(jobboardCompany.id),
      )
      .limit(MANAGEMENT_PAGE_SIZE);
  }
  async function listCompanySummaries({ q, page }: ListQuery) {
    const search = containsText(
      sql`concat_ws(' ', ${jobboardCompany.name}, ${companyHost})`,
      q,
    );
    const [counts] = await db
      .select({ total: count(), matched: countMatching(search) })
      .from(jobboardCompany);
    const bounds = pageBounds(page, counts.matched);
    const rows = await db
      .select({
        id: jobboardCompany.id,
        name: jobboardCompany.name,
        website: jobboardCompany.website,
        contactCount: sql<number>`jsonb_array_length(${jobboardCompany.contacts})`,
        jobCount: db.$count(
          jobboardJob,
          eq(jobboardJob.companyId, jobboardCompany.id),
        ),
      })
      .from(jobboardCompany)
      .where(search)
      .orderBy(asc(jobboardCompany.name), asc(jobboardCompany.id))
      .limit(MANAGEMENT_PAGE_SIZE)
      .offset((bounds.page - 1) * MANAGEMENT_PAGE_SIZE);
    return { rows, total: counts.total, ...bounds };
  }
  async function getCompanyJobCount(id: string) {
    const [row] = await db
      .select({ total: count() })
      .from(jobboardJob)
      .where(eq(jobboardJob.companyId, id));
    return row.total;
  }
  async function getCompanyWebsite(id: string) {
    const [row] = await db
      .select({ website: jobboardCompany.website })
      .from(jobboardCompany)
      .where(eq(jobboardCompany.id, id))
      .limit(1);
    return row?.website ?? null;
  }

  async function getPublishedCompanyWebsite(id: string) {
    const [row] = await db
      .select({
        website: sql<
          string | null
        >`${jobboardJob.published}->'company'->>'website'`,
      })
      .from(jobboardJob)
      .where(
        and(
          eq(jobboardJob.id, id),
          eq(jobboardJob.status, "published"),
          gt(jobboardJob.expiresAt, clock()),
          isNotNull(jobboardJob.published),
        ),
      )
      .limit(1);
    return row?.website ?? null;
  }

  async function getCompany(id: string) {
    return companyById(db, id);
  }
  async function deleteCompany(id: string, actor: JobboardActor) {
    return db.transaction(async (tx) => {
      const company = await companyById(tx, id, "update");
      const linked = await tx
        .select({ id: jobboardJob.id })
        .from(jobboardJob)
        .where(eq(jobboardJob.companyId, id))
        .limit(1);
      if (linked.length)
        throw new JobboardError(
          "company_in_use",
          "This company has linked jobs and cannot be deleted.",
          409,
        );
      await tx.delete(jobboardCompany).where(eq(jobboardCompany.id, id));
      await audit(
        tx,
        id,
        "company.deleted",
        `Deleted company ${company.name}.`,
        actor,
      );
      return { id };
    });
  }
  async function saveCompany(input: SaveCompanyInput, actor: JobboardActor) {
    const parsed = saveCompanySchema.parse(input);
    const { id: existingId, expectedUpdatedAt, ...values } = parsed;
    const id = existingId ?? newId("jobboardCompany");
    return db.transaction(async (tx) => {
      if (existingId) {
        const current = await companyById(tx, id, "update");
        if (current.updatedAt.toISOString() !== expectedUpdatedAt)
          throw new JobboardError(
            "company_conflict",
            "This company changed in another editor. Copy your edits before reloading and reviewing the latest version.",
            409,
          );
        const updatedAt = new Date(
          Math.max(clock().getTime(), current.updatedAt.getTime() + 1),
        );
        const changed = await tx
          .update(jobboardCompany)
          .set({ ...values, updatedAt })
          .where(eq(jobboardCompany.id, id))
          .returning();
        requireRow(changed[0], "Company");
      } else {
        await tx
          .insert(jobboardCompany)
          .values({ id, ...values, createdAt: clock(), updatedAt: clock() });
      }
      await audit(
        tx,
        id,
        existingId ? "company.updated" : "company.created",
        existingId
          ? "Updated company and private contact details."
          : "Created company.",
        actor,
      );
      return companyById(tx, id);
    });
  }
  async function listJobs() {
    const rows = await db
      .select({ job: jobboardJob, company: jobboardCompany })
      .from(jobboardJob)
      .innerJoin(jobboardCompany, eq(jobboardCompany.id, jobboardJob.companyId))
      .orderBy(desc(jobboardJob.updatedAt), asc(jobboardJob.id));
    return rows.map((row) => toJob(row.job, row.company));
  }
  const jobTitle = sql<string>`${jobboardJob.content}->>'title'`;
  function statusAt(now: Date) {
    return sql<JobStatus>`case when ${jobboardJob.status} = 'published' and
      (${jobboardJob.expiresAt} is null or ${jobboardJob.expiresAt} <= ${now.toISOString()}::timestamptz)
      then 'expired' else ${jobboardJob.status} end`;
  }
  async function listJobSummaries({ q, page, status, sort }: JobListQuery) {
    const effectiveStatus = statusAt(clock());
    const search = containsText(
      sql`concat_ws(' ', ${jobTitle}, ${jobboardCompany.name})`,
      q,
    );
    const aggregate = await db
      .select({
        status: effectiveStatus.as("effective_status"),
        total: count(),
        matching: countMatching(search),
      })
      .from(jobboardJob)
      .innerJoin(jobboardCompany, eq(jobboardCompany.id, jobboardJob.companyId))
      .groupBy(sql`effective_status`);
    const totals = statusTotals(aggregate, status);
    const bounds = pageBounds(page, totals.matched);
    const rows = await db
      .select({
        id: jobboardJob.id,
        title: jobTitle,
        companyId: jobboardJob.companyId,
        companyName: jobboardCompany.name,
        status: effectiveStatus,
        expiresAt: jobboardJob.expiresAt,
        updatedAt: jobboardJob.updatedAt,
        hasUnpublishedChanges: sql<boolean>`${jobboardJob.published} is not null and (
          ${jobboardJob.draftVersion} is distinct from ${jobboardJob.publishedDraftVersion}
          or ${jobboardJob.published}->'company'->>'id' is distinct from ${jobboardCompany.id}
          or ${jobboardJob.published}->'company'->>'name' is distinct from ${jobboardCompany.name}
          or ${jobboardJob.published}->'company'->>'website' is distinct from ${jobboardCompany.website}
          or ${jobboardJob.published}->'company'->>'description' is distinct from ${jobboardCompany.description}
        )`,
      })
      .from(jobboardJob)
      .innerJoin(jobboardCompany, eq(jobboardCompany.id, jobboardJob.companyId))
      .where(
        and(search, status === "all" ? undefined : eq(effectiveStatus, status)),
      )
      .orderBy(
        sort === "title"
          ? asc(sql`lower(${jobTitle})`)
          : sort === "expiry"
            ? asc(jobboardJob.expiresAt)
            : desc(jobboardJob.updatedAt),
        asc(jobboardJob.id),
      )
      .limit(MANAGEMENT_PAGE_SIZE)
      .offset((bounds.page - 1) * MANAGEMENT_PAGE_SIZE);
    return { rows, ...totals, ...bounds };
  }
  async function getJob(id: string) {
    return jobById(db, id);
  }
  async function saveJob(input: SaveJobInput, actor: JobboardActor) {
    const parsed = saveJobSchema.parse(input);
    const { id: existingId, expectedDraftVersion, ...values } = parsed;
    const id = existingId ?? newId("jobboardJob");
    return db.transaction(async (tx) => {
      await companyById(tx, values.companyId);
      if (existingId) {
        const current = await lockJob(tx, id);
        if (current.draftVersion !== expectedDraftVersion)
          throw new JobboardError(
            "draft_conflict",
            "This draft changed in another editor. Copy your edits before reloading and reviewing the latest version.",
            409,
          );
        const changed = await tx
          .update(jobboardJob)
          .set({
            ...values,
            draftVersion: sql`${jobboardJob.draftVersion} + 1`,
            updatedAt: clock(),
          })
          .where(eq(jobboardJob.id, id))
          .returning();
        requireRow(changed[0], "Job");
      } else {
        await tx.insert(jobboardJob).values({
          id,
          ...values,
          createdBy: actor.id,
          createdAt: clock(),
          updatedAt: clock(),
        });
      }
      await audit(
        tx,
        id,
        existingId ? "job.draft_updated" : "job.created",
        existingId
          ? "Saved draft. The approved public version is unchanged."
          : "Created an unpublished draft.",
        actor,
      );
      return jobById(tx, id);
    });
  }
  async function publishJob(
    input: PublishInput & { id: string },
    actor: JobboardActor,
  ) {
    const { id, ...review } = input;
    const parsed = publishInputSchema.parse(review);
    const now = clock();
    const expiresAt = new Date(parsed.expiresAt);
    if (
      expiresAt <= now ||
      expiresAt.getTime() > now.getTime() + MAX_LISTING_DAYS * DAY_MS
    ) {
      throw new JobboardError(
        "invalid_expiry",
        "Choose an expiry in the next 365 days.",
      );
    }
    return db.transaction(async (tx) => {
      // Serializes publishing with draft edits and other lifecycle actions.
      const job = await lockJob(tx, id);
      const company = await companyById(tx, job.companyId, "share");
      if (parsed.reviewToken !== reviewTokenFor(job, company))
        throw new JobboardError(
          "review_conflict",
          "This listing changed during review. Reload and review it again.",
          409,
        );
      const companySnapshot = publicCompanySchema.parse({
        id: company.id,
        name: company.name,
        website: company.website,
        description: company.description,
      });
      const snapshot = publicJobSchema.parse({
        id,
        slug: job.published?.slug ?? jobSlug(job.content.title, id),
        content: jobContentSchema.parse(job.content),
        company: companySnapshot,
        status: "active",
        publishedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      });
      await tx.insert(jobboardRevision).values({
        id: newId("jobboardRevision"),
        jobId: id,
        snapshot,
        reviewNotes: parsed.reviewNotes,
        actorId: actor.id,
        actorName: actor.name,
        createdAt: now,
      });
      await tx
        .update(jobboardJob)
        .set({
          published: snapshot,
          publishedAt: now,
          expiresAt,
          publishedDraftVersion: job.draftVersion,
          status: "published",
          updatedAt: now,
        })
        .where(eq(jobboardJob.id, id));
      await audit(
        tx,
        id,
        "job.published",
        `Approved a public version until ${expiresAt.toISOString()}. Review: ${parsed.reviewNotes}`,
        actor,
      );
      return jobById(tx, id);
    });
  }
  async function setJobStatus(
    id: string,
    transition: "paused" | "closed" | "draft" | "archive_draft",
    actor: JobboardActor,
  ) {
    const status = transition === "archive_draft" ? "closed" : transition;
    z.enum(["paused", "closed", "draft"]).parse(status);
    return db.transaction(async (tx) => {
      const row = await lockJob(tx, id);
      if (
        transition === "archive_draft" &&
        (row.status !== "draft" ||
          row.published !== null ||
          row.publishedAt !== null)
      )
        throw new JobboardError(
          "archive_conflict",
          "Only an unpublished draft can be archived by an editor. Reload to see the current listing.",
          409,
        );
      if (status === "paused" && !row.published)
        throw new JobboardError(
          "invalid_transition",
          "Only a previously published job can be paused.",
        );
      await tx
        .update(jobboardJob)
        .set({ status, updatedAt: clock() })
        .where(eq(jobboardJob.id, id));
      await audit(
        tx,
        id,
        `job.${status}`,
        `Changed job status to ${status}.`,
        actor,
      );
      return jobById(tx, id);
    });
  }
  async function editJobExpiry(
    input: EditJobExpiryInput,
    actor: JobboardActor,
  ) {
    const parsed = editJobExpirySchema.parse(input);
    return db.transaction(async (tx) => {
      const job = await lockJob(tx, parsed.id);
      const now = clock();
      if (
        !job.published ||
        !job.expiresAt ||
        effectiveJobStatus(job.status, job.expiresAt, now) !== "published"
      )
        throw new JobboardError(
          "invalid_transition",
          "Only active listings can change expiry. Review and publish this job again to reopen it.",
          409,
        );
      if (
        job.expiresAt.getTime() !==
          new Date(parsed.expectedExpiresAt).getTime() ||
        job.publishedAt?.getTime() !==
          new Date(parsed.expectedPublishedAt).getTime()
      )
        throw new JobboardError(
          "expiry_conflict",
          "This publication changed. Reload the job before changing its expiry.",
          409,
        );
      const expiresAt = new Date(parsed.expiresAt);
      if (
        expiresAt <= now ||
        expiresAt.getTime() > now.getTime() + MAX_LISTING_DAYS * DAY_MS
      )
        throw new JobboardError(
          "invalid_expiry",
          "Choose an expiry in the next 365 days.",
        );
      if (expiresAt.getTime() === job.expiresAt.getTime())
        return jobById(tx, parsed.id);
      // Preserve approved content and publication revisions. Expiry has its own audit event.
      await tx
        .update(jobboardJob)
        .set({
          published: { ...job.published, expiresAt: expiresAt.toISOString() },
          expiresAt,
          updatedAt: now,
        })
        .where(eq(jobboardJob.id, parsed.id));
      await audit(
        tx,
        parsed.id,
        "job.expiry_updated",
        `Changed expiry from ${job.expiresAt.toISOString()} to ${expiresAt.toISOString()}.`,
        actor,
      );
      return jobById(tx, parsed.id);
    });
  }
  async function listPublicJobs(
    input: {
      cursor?: string;
      limit?: number;
      q?: string;
      employmentType?: JobContent["employmentType"];
      remoteMode?: JobContent["remoteMode"];
    } = {},
  ) {
    const limit = Math.min(100, Math.max(1, input.limit ?? 50));
    const conditions = [
      eq(jobboardJob.status, "published"),
      gt(jobboardJob.expiresAt, clock()),
      isNotNull(jobboardJob.published),
    ];
    if (input.cursor) conditions.push(gt(jobboardJob.id, input.cursor));
    if (input.q)
      conditions.push(
        or(
          ilike(
            sql`${jobboardJob.published}->'content'->>'title'`,
            `%${input.q.replace(/[\\%_]/g, "\\$&")}%`,
          ),
          ilike(
            sql`${jobboardJob.published}->'company'->>'name'`,
            `%${input.q.replace(/[\\%_]/g, "\\$&")}%`,
          ),
        ) as NonNullable<ReturnType<typeof or>>,
      );
    if (input.employmentType)
      conditions.push(
        sql`${jobboardJob.published}->'content'->>'employmentType' = ${input.employmentType}`,
      );
    if (input.remoteMode)
      conditions.push(
        sql`${jobboardJob.published}->'content'->>'remoteMode' = ${input.remoteMode}`,
      );
    const rows = await db
      .select({
        id: jobboardJob.id,
        published: jobboardJob.published,
        status: jobboardJob.status,
        expiresAt: jobboardJob.expiresAt,
      })
      .from(jobboardJob)
      .where(and(...conditions))
      .orderBy(asc(jobboardJob.id))
      .limit(limit + 1);
    const jobs = rows
      .slice(0, limit)
      .map((row) => publicSnapshot(row, clock()))
      .filter(
        (job): job is PublicJob => job !== null && job.status === "active",
      );
    return {
      jobs,
      nextCursor: rows.length > limit ? rows[limit - 1].id : null,
    };
  }
  async function getPublicJob(id: string) {
    const row = (
      await db
        .select({
          published: jobboardJob.published,
          status: jobboardJob.status,
          expiresAt: jobboardJob.expiresAt,
        })
        .from(jobboardJob)
        .where(
          and(
            eq(jobboardJob.id, id),
            inArray(jobboardJob.status, ["published", "expired", "closed"]),
          ),
        )
        .limit(1)
    )[0];
    return row ? publicSnapshot(row, clock()) : null;
  }
  async function submitJob(input: SubmissionInput) {
    const payload = submissionInputSchema.parse(input);
    const payloadHash = createHash("sha256")
      .update(JSON.stringify(payload))
      .digest("hex");
    return db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(jobboardSubmission)
        .values({
          id: newId("jobboardSubmission"),
          requestId: payload.requestId,
          payloadHash,
          payload,
          createdAt: clock(),
          updatedAt: clock(),
        })
        .onConflictDoNothing({ target: jobboardSubmission.requestId })
        .returning({ id: jobboardSubmission.id });
      if (!inserted) {
        const existing = requireRow(
          (
            await tx
              .select({
                id: jobboardSubmission.id,
                payloadHash: jobboardSubmission.payloadHash,
              })
              .from(jobboardSubmission)
              .where(eq(jobboardSubmission.requestId, payload.requestId))
              .limit(1)
          )[0],
          "Submission",
        );
        if (existing.payloadHash !== payloadHash)
          throw new JobboardError(
            "idempotency_conflict",
            "This request ID was already used for a different submission.",
            409,
          );
        return { id: existing.id, status: "pending_review" as const };
      }
      await queueSubmissionNotifications(tx, inserted.id, clock());
      await audit(
        tx,
        inserted.id,
        "submission.received",
        "Received an employer submission for staff review.",
        { id: null, name: "Public jobboard service" },
      );
      return { id: inserted.id, status: "pending_review" as const };
    });
  }
  async function listSubmissions() {
    return db
      .select()
      .from(jobboardSubmission)
      .orderBy(desc(jobboardSubmission.createdAt), asc(jobboardSubmission.id));
  }
  async function listSubmissionSummaries({
    q,
    page,
    status,
  }: SubmissionListQuery) {
    const title = sql<string>`${jobboardSubmission.payload}->'job'->>'title'`;
    const companyName = sql<string>`${jobboardSubmission.payload}->'company'->>'name'`;
    const search = containsText(
      sql`concat_ws(' ', ${title}, ${companyName},
      ${jobboardSubmission.payload}->'contact'->>'name', ${jobboardSubmission.payload}->'contact'->>'email')`,
      q,
    );
    const aggregate = await db
      .select({
        status: jobboardSubmission.status,
        total: count(),
        matching: countMatching(search),
      })
      .from(jobboardSubmission)
      .groupBy(jobboardSubmission.status);
    const totals = statusTotals(aggregate, status);
    const bounds = pageBounds(page, totals.matched);
    const pending = eq(jobboardSubmission.status, "pending_review");
    const rows = await db
      .select({
        id: jobboardSubmission.id,
        status: jobboardSubmission.status,
        title,
        companyName,
        createdAt: jobboardSubmission.createdAt,
      })
      .from(jobboardSubmission)
      .where(
        and(
          search,
          status === "all" ? undefined : eq(jobboardSubmission.status, status),
        ),
      )
      .orderBy(
        desc(pending),
        asc(sql`case when ${pending} then ${jobboardSubmission.createdAt} end`),
        desc(jobboardSubmission.createdAt),
        asc(jobboardSubmission.id),
      )
      .limit(MANAGEMENT_PAGE_SIZE)
      .offset((bounds.page - 1) * MANAGEMENT_PAGE_SIZE);
    return { rows, ...totals, ...bounds };
  }
  async function getSubmissionReview(id: string) {
    const submission = requireRow(
      (
        await db
          .select({
            id: jobboardSubmission.id,
            status: jobboardSubmission.status,
            payload: jobboardSubmission.payload,
            reviewNote: jobboardSubmission.reviewNote,
            jobId: jobboardSubmission.jobId,
            createdAt: jobboardSubmission.createdAt,
          })
          .from(jobboardSubmission)
          .where(eq(jobboardSubmission.id, id))
      )[0],
      "Submission",
    );
    const { company, job } = submission.payload;
    const host = new URL(company.website).hostname
      .toLowerCase()
      .replace(/^www\./, "");
    const companyMatch = or(
      eq(companyHost, host),
      eq(sql`lower(${jobboardCompany.name})`, company.name.toLowerCase()),
    );
    const [possibleCompanies, duplicateJobs] = await Promise.all([
      db
        .select({ id: jobboardCompany.id, name: jobboardCompany.name })
        .from(jobboardCompany)
        .where(companyMatch)
        .orderBy(asc(jobboardCompany.name), asc(jobboardCompany.id))
        .limit(MANAGEMENT_PAGE_SIZE),
      db
        .select({ id: jobboardJob.id, title: jobTitle })
        .from(jobboardJob)
        .innerJoin(
          jobboardCompany,
          eq(jobboardCompany.id, jobboardJob.companyId),
        )
        .where(
          or(
            eq(sql`${jobboardJob.content}->>'applyUrl'`, job.applyUrl),
            and(
              eq(sql`lower(${jobTitle})`, job.title.toLowerCase()),
              companyMatch,
            ),
          ),
        )
        .orderBy(desc(jobboardJob.updatedAt), asc(jobboardJob.id))
        .limit(MANAGEMENT_PAGE_SIZE),
    ]);
    return { submission, possibleCompanies, duplicateJobs };
  }
  async function acceptSubmission(
    id: string,
    companyId: string,
    actor: JobboardActor,
  ) {
    return db.transaction(async (tx) => {
      const submission = requireRow(
        (
          await tx
            .select()
            .from(jobboardSubmission)
            .where(eq(jobboardSubmission.id, id))
            .for("update")
            .limit(1)
        )[0],
        "Submission",
      );
      if (submission.status === "accepted" && submission.jobId)
        return jobById(tx, submission.jobId);
      if (submission.status !== "pending_review")
        throw new JobboardError(
          "invalid_transition",
          "This submission has already been reviewed.",
          409,
        );
      await companyById(tx, companyId);
      const jobId = newId("jobboardJob");
      await tx.insert(jobboardJob).values({
        id: jobId,
        companyId,
        content: jobContentSchema.parse(submission.payload.job),
        notes: `Imported from submission ${id}. Verify the supplied details before publication.`,
        createdBy: actor.id,
        createdAt: clock(),
        updatedAt: clock(),
      });
      await tx
        .update(jobboardSubmission)
        .set({ status: "accepted", jobId, updatedAt: clock() })
        .where(eq(jobboardSubmission.id, id));
      await audit(
        tx,
        id,
        "submission.accepted",
        `Created draft ${jobId} using the company selected by staff.`,
        actor,
      );
      await audit(
        tx,
        jobId,
        "job.created_from_submission",
        `Created an unpublished draft from submission ${id}.`,
        actor,
      );
      return jobById(tx, jobId);
    });
  }
  async function rejectSubmission(
    id: string,
    note: string,
    actor: JobboardActor,
  ) {
    const reviewNote = z.string().trim().min(3).max(5000).parse(note);
    return db.transaction(async (tx) => {
      const submission = requireRow(
        (
          await tx
            .select()
            .from(jobboardSubmission)
            .where(eq(jobboardSubmission.id, id))
            .for("update")
            .limit(1)
        )[0],
        "Submission",
      );
      if (submission.status !== "pending_review")
        throw new JobboardError(
          "invalid_transition",
          "This submission has already been reviewed.",
          409,
        );
      const [updated] = await tx
        .update(jobboardSubmission)
        .set({ status: "rejected", reviewNote, updatedAt: clock() })
        .where(eq(jobboardSubmission.id, id))
        .returning();
      await audit(tx, id, "submission.rejected", reviewNote, actor);
      return updated;
    });
  }
  async function consumeServiceBudget(scope: "submit" | "metrics", weight = 1) {
    const limit = scope === "submit" ? 30 : 6000;
    if (!Number.isSafeInteger(weight) || weight < 1 || weight > limit)
      throw new JobboardError(
        "rate_limited",
        "Too many requests. Try again later.",
        429,
      );
    const now = clock();
    const windowStart = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
    const rows = await db
      .insert(jobboardServiceWindow)
      .values({ scope, windowStart, count: weight })
      .onConflictDoUpdate({
        target: [
          jobboardServiceWindow.scope,
          jobboardServiceWindow.windowStart,
        ],
        set: { count: sql`${jobboardServiceWindow.count} + ${weight}` },
        setWhere: sql`${jobboardServiceWindow.count} + ${weight} <= ${limit}`,
      })
      .returning({ count: jobboardServiceWindow.count });
    if (!rows.length)
      throw new JobboardError(
        "rate_limited",
        "Too many requests. Try again later.",
        429,
      );
  }
  async function recordMetrics(input: { events: MetricEvent[] }) {
    const { events } = metricsInputSchema.parse(input);
    const now = clock();
    for (const event of events) {
      const time = Date.parse(event.occurredAt);
      if (time < now.getTime() - DAY_MS || time > now.getTime() + 5 * 60_000)
        throw new JobboardError(
          "invalid_event_time",
          "Events must be from the past 24 hours and cannot be in the future.",
        );
      if (
        (event.type === "board_request" || event.type === "widget_request") &&
        event.jobId !== null
      )
        throw new JobboardError(
          "invalid_event",
          "Board and widget request counts cannot refer to a job.",
        );
    }
    return db.transaction(async (tx) => {
      const jobIds = [
        ...new Set(
          events.flatMap((event) => (event.jobId ? [event.jobId] : [])),
        ),
      ];
      if (jobIds.length) {
        const knownJobs = await tx
          .select({ id: jobboardJob.id })
          .from(jobboardJob)
          .where(
            and(
              inArray(jobboardJob.id, jobIds),
              isNotNull(jobboardJob.published),
            ),
          );
        if (knownJobs.length !== jobIds.length)
          throw new JobboardError(
            "invalid_event_job",
            "An event refers to an unavailable job.",
          );
      }
      const uniqueEvents = new Map<string, MetricEvent>();
      for (const event of events)
        if (!uniqueEvents.has(event.eventId))
          uniqueEvents.set(event.eventId, event);
      // Both receipts and aggregates acquire locks in a stable order across batches.
      const receipts = await tx
        .insert(jobboardMetricReceipt)
        .values(
          [...uniqueEvents.keys()].sort().map((eventId) => ({
            eventId,
            createdAt: now,
          })),
        )
        .onConflictDoNothing()
        .returning({ eventId: jobboardMetricReceipt.eventId });
      const increments = new Map<
        string,
        {
          day: string;
          jobId: string;
          type: MetricEvent["type"];
          surface: MetricEvent["surface"];
          source: MetricEvent["source"];
          count: number;
        }
      >();
      for (const receipt of receipts) {
        const event = uniqueEvents.get(receipt.eventId);
        if (!event) continue;
        const bucket = {
          day: new Date(event.occurredAt).toISOString().slice(0, 10),
          jobId: event.jobId ?? "",
          type: event.type,
          surface: event.surface,
          source: event.source,
          count: 1,
        };
        const key = JSON.stringify([
          bucket.day,
          bucket.jobId,
          bucket.type,
          bucket.surface,
          bucket.source,
        ]);
        const increment = increments.get(key);
        if (increment) increment.count++;
        else increments.set(key, bucket);
      }
      if (increments.size) {
        const buckets = [...increments]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([, bucket]) => bucket);
        await tx
          .insert(jobboardMetricDaily)
          .values(buckets)
          .onConflictDoUpdate({
            target: [
              jobboardMetricDaily.day,
              jobboardMetricDaily.jobId,
              jobboardMetricDaily.type,
              jobboardMetricDaily.surface,
              jobboardMetricDaily.source,
            ],
            set: { count: sql`${jobboardMetricDaily.count} + excluded.count` },
          });
      }
      return { accepted: receipts.length };
    });
  }
  async function getAnalytics(range: { from?: string; to?: string } = {}) {
    const now = clock();
    const from =
      range.from ??
      new Date(now.getTime() - 29 * DAY_MS).toISOString().slice(0, 10);
    const to = range.to ?? now.toISOString().slice(0, 10);
    z.iso.date().parse(from);
    z.iso.date().parse(to);
    if (from > to)
      throw new JobboardError(
        "invalid_range",
        "The start date must come before the end date.",
      );
    const rows = await db
      .select({
        metric: jobboardMetricDaily,
        title: sql<
          string | null
        >`${jobboardJob.published}->'content'->>'title'`,
      })
      .from(jobboardMetricDaily)
      .leftJoin(jobboardJob, eq(jobboardMetricDaily.jobId, jobboardJob.id))
      .where(
        and(
          gte(jobboardMetricDaily.day, from),
          lte(jobboardMetricDaily.day, to),
        ),
      )
      .orderBy(asc(jobboardMetricDaily.day));
    const totals = emptyTotals();
    const daily = new Map<string, MetricTotals>();
    const jobs = new Map<
      string,
      MetricTotals & { jobId: string; title: string }
    >();
    const sourceRows = new Map<string, MetricTotals>();
    for (const { metric, title } of rows) {
      const property = metricProperty[metric.type];
      if (!property) continue;
      totals[property] += metric.count;
      const day = daily.get(metric.day) ?? emptyTotals();
      day[property] += metric.count;
      daily.set(metric.day, day);
      const source = sourceRows.get(metric.source) ?? emptyTotals();
      source[property] += metric.count;
      sourceRows.set(metric.source, source);
      if (metric.jobId) {
        const job = jobs.get(metric.jobId) ?? {
          ...emptyTotals(),
          jobId: metric.jobId,
          title: title ?? "Closed job",
        };
        job[property] += metric.count;
        jobs.set(metric.jobId, job);
      }
    }
    return {
      from,
      to,
      totals,
      daily: [...daily].map(([date, values]) => ({ date, ...values })),
      jobs: [...jobs.values()].sort((a, b) => b.jobViews - a.jobViews),
      sources: [...sourceRows].map(([source, values]) => ({
        source,
        ...values,
      })),
    };
  }
  async function getDashboard() {
    const now = clock();
    const statusRows = db
      .select({
        status: statusAt(now).as("effective_status"),
      })
      .from(jobboardJob)
      .as("job_statuses");
    const [statuses, companies, submissions, expiringJobs] = await Promise.all([
      db
        .select({ status: statusRows.status, total: count() })
        .from(statusRows)
        .groupBy(statusRows.status),
      db.select({ total: count() }).from(jobboardCompany),
      db
        .select({ total: count() })
        .from(jobboardSubmission)
        .where(eq(jobboardSubmission.status, "pending_review")),
      db
        .select({
          id: jobboardJob.id,
          title: jobTitle,
          companyName: jobboardCompany.name,
          expiresAt: jobboardJob.expiresAt,
        })
        .from(jobboardJob)
        .innerJoin(
          jobboardCompany,
          eq(jobboardCompany.id, jobboardJob.companyId),
        )
        .where(
          and(
            eq(jobboardJob.status, "published"),
            gt(jobboardJob.expiresAt, now),
            lte(jobboardJob.expiresAt, new Date(now.getTime() + 7 * DAY_MS)),
          ),
        )
        .orderBy(asc(jobboardJob.expiresAt), asc(jobboardJob.id))
        .limit(MANAGEMENT_PAGE_SIZE),
    ]);
    const counts = { draft: 0, published: 0, paused: 0, closed: 0, expired: 0 };
    for (const row of statuses) counts[row.status] = row.total;
    return {
      counts,
      pendingSubmissions: submissions[0].total,
      activeCompanies: companies[0].total,
      expiringJobs,
    };
  }
  async function getAudit(input: { entityId?: string } = {}) {
    return db
      .select()
      .from(jobboardAudit)
      .where(
        input.entityId ? eq(jobboardAudit.entityId, input.entityId) : undefined,
      )
      .orderBy(desc(jobboardAudit.createdAt), desc(jobboardAudit.id))
      .limit(500);
  }
  async function getRevisions(jobId: string) {
    return db
      .select()
      .from(jobboardRevision)
      .where(eq(jobboardRevision.jobId, jobId))
      .orderBy(desc(jobboardRevision.createdAt));
  }
  async function runMaintenance() {
    const now = clock();
    const aggregateCutoff = aggregateRetentionCutoff(now);
    return db.transaction(async (tx) => {
      const receipts = await tx
        .delete(jobboardMetricReceipt)
        .where(
          lt(
            jobboardMetricReceipt.createdAt,
            new Date(now.getTime() - 2 * DAY_MS),
          ),
        );
      const aggregates = await tx
        .delete(jobboardMetricDaily)
        .where(lt(jobboardMetricDaily.day, aggregateCutoff));
      await tx
        .delete(jobboardServiceWindow)
        .where(
          lt(
            jobboardServiceWindow.windowStart,
            new Date(now.getTime() - DAY_MS),
          ),
        );
      const expired = await tx
        .update(jobboardJob)
        .set({ status: "expired", updatedAt: now })
        .where(
          and(
            eq(jobboardJob.status, "published"),
            lte(jobboardJob.expiresAt, now),
          ),
        )
        .returning({ id: jobboardJob.id });
      for (const job of expired)
        await audit(
          tx,
          job.id,
          "job.expired",
          "The publication period ended.",
          { id: null, name: "Jobboard maintenance" },
        );
      return {
        receiptsRemoved: receipts.rowCount ?? 0,
        aggregateRowsRemoved: aggregates.rowCount ?? 0,
        jobsExpired: expired.length,
      };
    });
  }
  return {
    listCompanies,
    listCompanyOptions,
    listCompanySummaries,
    getCompanyJobCount,
    getCompany,
    getCompanyWebsite,
    getPublishedCompanyWebsite,
    deleteCompany,
    saveCompany,
    listJobs,
    listJobSummaries,
    listSubmissionSummaries,
    getSubmissionReview,
    getJob,
    saveJob,
    publishJob,
    editJobExpiry,
    setJobStatus,
    listPublicJobs,
    getPublicJob,
    submitJob,
    listSubmissions,
    acceptSubmission,
    rejectSubmission,
    consumeServiceBudget,
    recordMetrics,
    getAnalytics,
    getDashboard,
    getAudit,
    getRevisions,
    runMaintenance,
  };
}
