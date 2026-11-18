import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { user } from "@/db/schema/auth";
import { userOrganizationPosition } from "@/db/schema/authority";
import type {
  JobContent,
  MetricEvent,
  SubmissionInput,
} from "../lib/contracts";
import { createJobboardHttp } from "../lib/http";
import { createJobboardEmailQueue } from "./email-queue";
import { createJobboardNotifications } from "./notifications";
import {
  jobboardAudit,
  jobboardCompany,
  jobboardJob,
  jobboardMetricDaily,
  jobboardMetricReceipt,
  jobboardRevision,
  jobboardServiceWindow,
  jobboardSubmission,
  jobboardSubmissionNotification as notification,
} from "./schema";
import { createJobboardService, JobboardError } from "./service";

const connectionString = process.env.JOBBOARD_TEST_DATABASE_URL;
if (connectionString) {
  const target = new URL(connectionString);
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
    target.pathname !== "/jobboard_test"
  ) {
    throw new Error(
      "JOBBOARD_TEST_DATABASE_URL must explicitly target the local jobboard_test database.",
    );
  }
}

describe("jobboard PostgreSQL integration", { skip: !connectionString }, () => {
  const pool = new Pool({ connectionString, max: 8 });
  const db = drizzle({ client: pool });
  let now = new Date();
  const service = createJobboardService(db, () => new Date(now));
  const actor = { id: null, name: "Jobboard integration test" };
  const companyIds: string[] = [];
  const jobIds: string[] = [];
  const submissionIds: string[] = [];
  const eventIds: string[] = [];
  const keys = {
    read: "r".repeat(40),
    submit: "s".repeat(40),
    metrics: "m".repeat(40),
  };
  const api = createJobboardHttp(service, () => keys);
  const content = (title = "Integration Software Engineer"): JobContent => ({
    title,
    description:
      "Build useful software with our small engineering team and help maintain the platform.",
    employmentType: "full_time",
    seniority: "all",
    locations: ["Berlin"],
    countryCodes: ["DE"],
    remoteMode: "hybrid",
    languages: ["English"],
    applyUrl: "https://example.com/apply",
    salaryStatus: "not_disclosed",
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: "EUR",
    salaryPeriod: "year",
    weeklyHours: 40,
    internshipDurationMonths: null,
  });
  async function company() {
    const row = await service.saveCompany(
      {
        name: `Integration ${randomUUID()}`,
        website: "https://example.com",
        description: "Approved company description",
        notes: "PRIVATE internal notes",
        terms: "PRIVATE unpaid pilot terms",
        contacts: [
          {
            name: "Private Contact",
            email: "private@example.com",
            role: "Recruiter",
            phone: "+49123456",
            notes: "PRIVATE contact notes",
          },
          {
            name: "Second Contact",
            email: "second@example.com",
            role: "Hiring manager",
            phone: "",
            notes: "",
          },
        ],
      },
      actor,
    );
    companyIds.push(row.id);
    return row;
  }
  async function draft(companyId: string, title?: string) {
    const row = await service.saveJob(
      { companyId, content: content(title), notes: "PRIVATE editorial notes" },
      actor,
    );
    jobIds.push(row.id);
    return row;
  }
  async function publish(
    id: string,
    expiresAt = new Date(now.getTime() + 60 * 86_400_000).toISOString(),
  ) {
    const job = await service.getJob(id);
    return service.publishJob(
      {
        id,
        reviewToken: job.reviewToken,
        expiresAt,
        reviewed: true,
        reviewNotes: "Reviewed employer, application URL and listing content.",
      },
      actor,
    );
  }
  function event(jobId: string): MetricEvent {
    const eventId = randomUUID();
    eventIds.push(eventId);
    return {
      eventId,
      occurredAt: now.toISOString(),
      type: "detail_request",
      jobId,
      surface: "standalone",
      source: "unknown",
    };
  }
  function submission(requestId = randomUUID()): SubmissionInput {
    return {
      requestId,
      company: {
        name: "Unverified Employer",
        website: "https://example.org",
        description: "Information provided by the employer.",
      },
      contact: {
        name: "Unverified Contact",
        email: "unverified@example.org",
        phone: "",
        role: "",
        notes: "",
      },
      job: content("Employer supplied role"),
      permissionToPublish: true,
    };
  }
  before(async () => {
    await pool.query("SELECT 1 FROM jobboard_job LIMIT 1");
  });

  test("a submission notifies its original active recipients once and keeps each inbox private", async () => {
    const lead = randomUUID();
    const inactiveLead = randomUUID();
    const member = randomUUID();
    const app = createJobboardNotifications(db);
    const ids = [lead, inactiveLead, member];
    try {
      await db.insert(user).values(
        ids.map((id) => ({
          id,
          name: "Test User",
          firstName: "Test",
          lastName: "User",
          status:
            id === inactiveLead ? ("alumni" as const) : ("member" as const),
        })),
      );
      await db.insert(userOrganizationPosition).values(
        [lead, inactiveLead].map((userId) => ({
          userId,
          position: "department_co_lead" as const,
          scope: "department" as const,
          department: "growth" as const,
        })),
      );
      const payload = submission();
      const [first, retry] = await Promise.all([
        service.submitJob(payload),
        service.submitJob(payload),
      ]);
      submissionIds.push(first.id);
      assert.equal(retry.id, first.id);
      assert.equal(await app.unreadCount(lead), 1);
      assert.equal(await app.unreadCount(inactiveLead), 0);
      assert.equal(await app.unreadCount(member), 0);
      const { items } = await app.list(lead, 1);
      assert.deepEqual(
        items.map((row) => row.submissionId),
        [first.id],
      );
      assert.equal(items[0].company, payload.company.name);
      const detail = await app.detail(lead, first.id);
      assert.deepEqual(detail?.company, { name: payload.company.name });
      assert.equal(detail?.job.title, payload.job.title);
      assert.ok(!JSON.stringify(detail).includes(payload.contact.email));
      assert.equal(await app.detail(member, first.id), null);
      assert.equal(await app.markRead(member, first.id), false);
      assert.equal(await app.unreadCount(lead), 1);
      assert.equal(await app.markRead(lead, first.id), true);
      const read = await app.detail(lead, first.id);
      assert.ok(read?.readAt);
      assert.equal(await app.markRead(lead, first.id), true);
      assert.equal(
        (await app.detail(lead, first.id))?.readAt?.getTime(),
        read.readAt.getTime(),
      );
      assert.equal(await app.unreadCount(lead), 0);
      // An idempotent retry must not send an old submission to a newly appointed lead.
      await db.insert(userOrganizationPosition).values({
        userId: member,
        position: "department_co_lead",
        scope: "department",
        department: "growth",
      });
      await service.submitJob(payload);
      assert.equal(await app.detail(member, first.id), null);
    } finally {
      await db.delete(user).where(inArray(user.id, ids));
    }
  });
  test("submission email claims are exclusive, bounded and never replay uncertain deliveries", async (t) => {
    const userId = randomUUID();
    const email = `jobboard-test-${userId}@workspace.example`;
    await db.insert(user).values({
      id: userId,
      name: "Test lead",
      firstName: "Test",
      lastName: "Lead",
      status: "member",
      email,
      emailVerified: true,
    });
    t.after(() => db.delete(user).where(eq(user.id, userId)).execute());
    await db.insert(userOrganizationPosition).values({
      userId,
      position: "department_co_lead",
      scope: "department",
      department: "growth",
    });
    // Only the fixture's recipient is due for this test. Other recipients in a
    // pre-seeded test DB can keep their ordinary delivery schedule.
    let time = new Date("2000-01-01T00:00:00Z");
    const queue = createJobboardEmailQueue(db, () => time);
    const writer = createJobboardService(db, () => new Date(now), {
      emailEnabled: true,
    });
    const owned = (id: string) =>
      and(eq(notification.userId, userId), eq(notification.submissionId, id));
    const state = async (id: string) =>
      (await db.select().from(notification).where(owned(id)))[0];
    const createDue = async () => {
      const payload = submission();
      const [a, b] = await Promise.all([
        writer.submitJob(payload),
        writer.submitJob(payload),
      ]);
      assert.equal(a.id, b.id);
      submissionIds.push(a.id);
      assert.equal((await state(a.id)).emailStatus, "pending");
      await db
        .update(notification)
        .set({ emailNextActionAt: time })
        .where(owned(a.id));
      return a.id;
    };

    const existingPayload = submission();
    const existing = await service.submitJob(existingPayload);
    submissionIds.push(existing.id);
    assert.equal((await state(existing.id)).emailStatus, "disabled");
    await db
      .update(notification)
      .set({ emailStatus: null })
      .where(owned(existing.id));
    await writer.submitJob(existingPayload);
    assert.equal((await state(existing.id)).emailStatus, null);

    const exhausted = await createDue();
    const claims = await Promise.all([queue.claimNext(), queue.claimNext()]);
    const [first] = claims.filter((claim) => claim !== null);
    assert.ok(first && typeof first === "object");
    assert.equal(claims.filter(Boolean).length, 1);
    assert.deepEqual(
      [first.email, first.companyName, first.jobTitle],
      [email, "Unverified Employer", "Employer supplied role"],
    );
    assert.equal(await queue.retry(first, 30), "pending");
    assert.equal(await queue.retry(first, 30), "stale");
    assert.equal(await queue.claimNext(), null);
    time = new Date(time.getTime() + 30_000);
    const second = await queue.claimNext();
    assert.ok(second && typeof second === "object");
    assert.notEqual(first.token, second.token);
    assert.equal(await queue.finish(first, "accepted"), false);
    assert.equal(await queue.retry(second, 1), "pending");
    time = new Date(time.getTime() + 1000);
    const third = await queue.claimNext();
    assert.ok(third && typeof third === "object");
    assert.equal(await queue.retry(third, 1), "exhausted");
    assert.equal((await state(exhausted)).emailStatus, "exhausted");
    assert.equal((await state(exhausted)).emailAttempts, 3);

    const lost = await createDue();
    const lostClaim = await queue.claimNext();
    assert.ok(lostClaim && typeof lostClaim === "object");
    time = new Date(time.getTime() + 16 * 60_000);
    assert.equal(await queue.claimNext(), "uncertain");
    assert.equal((await state(lost)).emailStatus, "uncertain");
    assert.equal(await queue.finish(lostClaim, "accepted"), false);

    const closed = await createDue();
    await service.rejectSubmission(
      closed,
      "Closed before the email worker ran.",
      actor,
    );
    const deliverable = await queue.claimNext();
    assert.ok(deliverable && typeof deliverable === "object");
    assert.equal(deliverable.submissionId, closed);
    assert.ok(await queue.finish(deliverable, "accepted"));
    assert.equal(await queue.finish(deliverable, "accepted"), false);
    assert.equal((await state(closed)).readAt, null);

    const unverified = await createDue();
    await db
      .update(user)
      .set({ emailVerified: false })
      .where(eq(user.id, userId));
    assert.equal(await queue.claimNext(), "skipped");
    assert.equal((await state(unverified)).emailStatus, "skipped");
    await db
      .update(user)
      .set({ emailVerified: true })
      .where(eq(user.id, userId));

    const revoked = await createDue();
    await db
      .delete(userOrganizationPosition)
      .where(eq(userOrganizationPosition.userId, userId));
    assert.equal(await queue.claimNext(), "skipped");
    assert.equal((await state(revoked)).emailStatus, "skipped");
  });

  after(async () => {
    try {
      if (eventIds.length)
        await db
          .delete(jobboardMetricReceipt)
          .where(inArray(jobboardMetricReceipt.eventId, eventIds));
      if (jobIds.length) {
        await db
          .delete(jobboardMetricDaily)
          .where(inArray(jobboardMetricDaily.jobId, jobIds));
        await db
          .delete(jobboardRevision)
          .where(inArray(jobboardRevision.jobId, jobIds));
      }
      if (submissionIds.length)
        await db
          .delete(jobboardSubmission)
          .where(inArray(jobboardSubmission.id, submissionIds));
      if (jobIds.length)
        await db.delete(jobboardJob).where(inArray(jobboardJob.id, jobIds));
      if (companyIds.length)
        await db
          .delete(jobboardCompany)
          .where(inArray(jobboardCompany.id, companyIds));
      const entityIds = [...companyIds, ...jobIds, ...submissionIds];
      if (entityIds.length)
        await db
          .delete(jobboardAudit)
          .where(inArray(jobboardAudit.entityId, entityIds));
      await db
        .delete(jobboardServiceWindow)
        .where(
          eq(
            jobboardServiceWindow.windowStart,
            new Date("2032-01-01T00:00:00Z"),
          ),
        );
    } finally {
      await pool.end();
    }
  });

  test("company supports multiple private contacts and linked companies cannot be deleted", async () => {
    const co = await company();
    assert.equal((await service.getCompany(co.id)).contacts.length, 2);
    await draft(co.id);
    await assert.rejects(
      service.deleteCompany(co.id, actor),
      (error: unknown) =>
        error instanceof JobboardError && error.code === "company_in_use",
    );
    const unused = await company();
    await service.deleteCompany(unused.id, actor);
    await assert.rejects(
      service.getCompany(unused.id),
      (error: unknown) =>
        error instanceof JobboardError && error.status === 404,
    );
  });

  test("closing an unpublished draft archives it without creating a public page", async () => {
    const co = await company();
    const job = await draft(co.id);
    await service.setJobStatus(job.id, "archive_draft", actor);
    assert.equal((await service.getJob(job.id)).status, "closed");
    assert.equal(await service.getPublicJob(job.id), null);
    assert.equal((await service.getRevisions(job.id)).length, 0);
  });

  test("editor archiving cannot close a job published by a competing reviewer", async () => {
    const co = await company();
    const job = await draft(co.id);
    const results = await Promise.allSettled([
      service.publishJob(
        {
          id: job.id,
          reviewToken: job.reviewToken,
          expiresAt: new Date(now.getTime() + 60 * 86_400_000).toISOString(),
          reviewed: true,
          reviewNotes: "Reviewed before the other editor archived the draft.",
        },
        actor,
      ),
      service.setJobStatus(job.id, "archive_draft", actor),
    ]);
    const [publication, archive] = results;
    if (publication.status === "fulfilled") {
      assert.equal(archive.status, "rejected");
      assert.equal((await service.getPublicJob(job.id))?.status, "active");
    } else {
      assert.equal(archive.status, "fulfilled");
      assert.equal(await service.getPublicJob(job.id), null);
    }
    const failure = results.find((result) => result.status === "rejected");
    assert.ok(failure?.reason instanceof JobboardError);
    assert.equal(failure.reason.status, 409);
  });

  test("a previously published listing returned to draft cannot be archived by an editor", async () => {
    const co = await company();
    const job = await draft(co.id);
    await publish(job.id);
    await service.setJobStatus(job.id, "draft", actor);
    await assert.rejects(service.setJobStatus(job.id, "archive_draft", actor), {
      code: "archive_conflict",
    });
    assert.equal((await service.getJob(job.id)).status, "draft");
  });

  test("draft and live company edits cannot alter an approved public version", async () => {
    const co = await company();
    const job = await draft(co.id);
    assert.equal(await service.getPublicJob(job.id), null);
    const live = await publish(job.id);
    assert.equal(live.published?.content.title, job.title);
    assert.doesNotMatch(
      JSON.stringify(live.published),
      /PRIVATE|private@example|second@example|contacts|terms/,
    );
    await service.saveJob(
      {
        id: job.id,
        expectedDraftVersion: job.draftVersion,
        companyId: co.id,
        content: content("Unreviewed new title"),
        notes: "Changed privately",
      },
      actor,
    );
    await service.saveCompany(
      {
        id: co.id,
        expectedUpdatedAt: co.updatedAt.toISOString(),
        name: "Unreviewed new company name",
        website: co.website,
        description: "Unreviewed description",
        notes: co.notes,
        terms: co.terms,
        contacts: co.contacts,
      },
      actor,
    );
    const before = await service.getPublicJob(job.id);
    assert.equal(before?.content.title, job.title);
    assert.equal(before?.company.name, co.name);
    assert.equal((await service.getJob(job.id)).hasUnpublishedChanges, true);
    await publish(job.id);
    const after = await service.getPublicJob(job.id);
    assert.equal(after?.content.title, "Unreviewed new title");
    assert.equal(after?.company.name, "Unreviewed new company name");
    const revisions = await service.getRevisions(job.id);
    assert.equal(revisions.length, 2);
    assert.ok(
      revisions.some(
        (revision) =>
          revision.snapshot.content.title === job.title &&
          revision.snapshot.company.name === co.name,
      ),
    );
    assert.ok(
      (await service.getAudit({ entityId: job.id })).some(
        (row) => row.eventType === "job.published",
      ),
    );
  });

  test("two editors saving the same draft cannot overwrite each other", async () => {
    const co = await company();
    const job = await draft(co.id);
    await publish(job.id);
    const input = {
      id: job.id,
      expectedDraftVersion: job.draftVersion,
      companyId: co.id,
      notes: "Concurrent editor notes",
    };
    const results = await Promise.allSettled([
      service.saveJob(
        { ...input, content: content("First editor's changes") },
        actor,
      ),
      service.saveJob(
        { ...input, content: content("Second editor's changes") },
        actor,
      ),
    ]);
    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1,
    );
    const failure = results.find((result) => result.status === "rejected");
    assert.ok(failure?.status === "rejected");
    assert.ok(failure.reason instanceof JobboardError);
    assert.equal(failure.reason.code, "draft_conflict");
    assert.equal(failure.reason.status, 409);
    const saved = await service.getJob(job.id);
    assert.equal(saved.draftVersion, job.draftVersion + 1);
    assert.equal(
      (await service.getPublicJob(job.id))?.content.title,
      job.title,
    );
    assert.equal(
      (await service.getAudit({ entityId: job.id })).filter(
        (row) => row.eventType === "job.draft_updated",
      ).length,
      1,
    );
  });

  test("concurrent company edits preserve the winning contacts even when the clock does not advance", async () => {
    const co = await company();
    const input = {
      id: co.id,
      expectedUpdatedAt: co.updatedAt.toISOString(),
      name: co.name,
      website: co.website,
      description: co.description,
      notes: co.notes,
      terms: co.terms,
    };
    const results = await Promise.allSettled([
      service.saveCompany(
        { ...input, contacts: [{ ...co.contacts[0], name: "First editor" }] },
        actor,
      ),
      service.saveCompany(
        { ...input, contacts: [{ ...co.contacts[0], name: "Second editor" }] },
        actor,
      ),
    ]);
    const winner = results.find((result) => result.status === "fulfilled");
    const failure = results.find((result) => result.status === "rejected");
    assert.ok(winner?.status === "fulfilled");
    assert.ok(failure?.status === "rejected");
    assert.ok(failure.reason instanceof JobboardError);
    assert.equal(failure.reason.code, "company_conflict");
    const saved = await service.getCompany(co.id);
    assert.deepEqual(saved.contacts, winner.value.contacts);
    assert.ok(saved.updatedAt > co.updatedAt);
    const next = await service.saveCompany(
      {
        ...input,
        expectedUpdatedAt: saved.updatedAt.toISOString(),
        contacts: saved.contacts,
        notes: "Fresh subsequent edit",
      },
      actor,
    );
    assert.ok(next.updatedAt > saved.updatedAt);
    assert.equal(
      (await service.getAudit({ entityId: co.id })).filter(
        (row) => row.eventType === "company.updated",
      ).length,
      2,
    );
  });

  test("management summaries keep private fields out and use query-time expiry in counts", async () => {
    const before = await service.getDashboard();
    const co = await company();
    const job = await draft(co.id);
    assert.equal(await service.getCompanyWebsite(co.id), co.website);
    assert.equal(await service.getPublishedCompanyWebsite(job.id), null);
    await publish(job.id, new Date(now.getTime() + 1000).toISOString());
    assert.equal(await service.getPublishedCompanyWebsite(job.id), co.website);
    const options = await service.listCompanyOptions(co.name);
    assert.deepEqual(
      Object.keys(options.find((row) => row.id === co.id) ?? {}).sort(),
      ["description", "id", "name", "website"],
    );
    const { rows: companies } = await service.listCompanySummaries({
      q: co.name,
      page: 1,
    });
    assert.deepEqual(
      companies.find((row) => row.id === co.id),
      {
        id: co.id,
        name: co.name,
        website: co.website,
        contactCount: 2,
        jobCount: 1,
      },
    );
    assert.equal(await service.getCompanyJobCount(co.id), 1);
    const originalNow = now;
    try {
      now = new Date(now.getTime() + 1001);
      const { rows: jobs } = await service.listJobSummaries({
        q: co.name,
        sort: "updated",
        status: "expired",
        page: 1,
      });
      const summary = jobs.find((row) => row.id === job.id);
      assert.equal(await service.getPublishedCompanyWebsite(job.id), null);
      assert.equal(summary?.companyId, co.id);
      assert.equal(summary?.status, "expired");
      assert.equal(summary?.hasUnpublishedChanges, false);
      assert.doesNotMatch(
        JSON.stringify(summary),
        /PRIVATE|private@example|contacts|reviewToken|publishedAt|applyUrl/,
      );
      const dashboard = await service.getDashboard();
      assert.equal(dashboard.counts.expired, before.counts.expired + 1);
      assert.equal(dashboard.activeCompanies, before.activeCompanies + 1);
      assert.equal(dashboard.counts.published, before.counts.published);
      assert.ok(!dashboard.expiringJobs.some((row) => row.id === job.id));
      await service.saveCompany(
        {
          id: co.id,
          expectedUpdatedAt: co.updatedAt.toISOString(),
          name: "Changed company awaiting publication",
          website: co.website,
          description: co.description,
          contacts: co.contacts,
          notes: co.notes,
          terms: co.terms,
        },
        actor,
      );
      assert.equal(
        (
          await service.listJobSummaries({
            q: "Changed company awaiting publication",
            sort: "updated",
            status: "all",
            page: 1,
          })
        ).rows.find((row) => row.id === job.id)?.hasUnpublishedChanges,
        true,
      );
    } finally {
      now = originalNow;
    }
  });

  test("management lists search across pages without leaking submission payloads", async () => {
    const co = await company();
    const token = `Pagination %_ ${randomUUID()}`;
    for (let index = 0; index < 26; index++) {
      await draft(co.id, `${token} ${String(index).padStart(2, "0")}`);
    }
    const query = {
      q: token.toUpperCase(),
      sort: "title",
      status: "draft",
      page: 1,
    } as const;
    const first = await service.listJobSummaries(query);
    const last = await service.listJobSummaries({ ...query, page: 9999 });
    assert.equal(first.rows.length, 25);
    assert.equal(first.matched, 26);
    assert.equal(last.page, 2);
    assert.equal(last.rows[0].title, `${token} 25`);
    assert.ok(!first.rows.some((row) => row.id === last.rows[0].id));
    assert.equal(
      (await service.listJobSummaries({ ...query, q: `${token} 25`, page: 2 }))
        .page,
      1,
    );
    assert.equal(
      (await service.listJobSummaries({ ...query, status: "published" }))
        .matched,
      0,
    );

    const input = submission();
    input.job.title = `${token} 25`;
    input.company.name = co.name.toLowerCase();
    input.job.applyUrl = "https://example.org/different-application";
    input.contact.email = `private-${randomUUID()}@example.org`;
    const { id } = await service.submitJob(input);
    submissionIds.push(id);
    const page = await service.listSubmissionSummaries({
      q: input.contact.email,
      status: "pending_review",
      page: -3,
    });
    assert.equal(page.page, 1);
    assert.deepEqual(
      page.rows.map((row) => row.id),
      [id],
    );
    assert.deepEqual(Object.keys(page.rows[0]).sort(), [
      "companyName",
      "createdAt",
      "id",
      "status",
      "title",
    ]);
    const review = await service.getSubmissionReview(id);
    assert.equal(review.submission.payload.contact.email, input.contact.email);
    assert.ok(review.possibleCompanies.some((row) => row.id === co.id));
    assert.ok(review.duplicateJobs.some((row) => row.id === last.rows[0].id));
  });

  test("company selection and the mixed submission queue remain usable beyond page one", async () => {
    const token = `Page ${randomUUID()}`;
    let lastCompanyId = "";
    for (let index = 0; index < 26; index++) {
      const co = await service.saveCompany(
        {
          name: `${token} ${String(index).padStart(2, "0")}`,
          website: "https://www.Example.com:8080/team?ref=start",
          description: "A company profile.",
          notes: "",
          terms: "",
          contacts: [],
        },
        actor,
      );
      companyIds.push(co.id);
      lastCompanyId = co.id;
    }
    const companies = await service.listCompanySummaries({ q: token, page: 2 });
    assert.equal(companies.matched, 26);
    assert.deepEqual(
      companies.rows.map((row) => row.id),
      [lastCompanyId],
    );
    const options = await service.listCompanyOptions(token);
    assert.equal(options.length, 25);
    assert.ok(!options.some((row) => row.id === lastCompanyId));
    assert.equal(
      (await service.listCompanyOptions(`${token} 25`))[0].id,
      lastCompanyId,
    );
    assert.equal(
      (await service.listCompanyOptions("", lastCompanyId))[0].id,
      lastCompanyId,
    );
    assert.deepEqual(
      (
        await service.listCompanySummaries({
          q: `${token} 25 example.com`,
          page: 1,
        })
      ).rows.map((row) => row.id),
      [lastCompanyId],
    );

    const originalNow = now;
    try {
      const queue = [];
      for (let index = 0; index < 26; index++) {
        now = new Date(originalNow.getTime() + index * 1000);
        const payload = submission();
        payload.company.name = token;
        const row = await service.submitJob(payload);
        submissionIds.push(row.id);
        queue.push(row.id);
      }
      await service.rejectSubmission(queue[1], "Already filled.", actor);
      const pending = await service.listSubmissionSummaries({
        q: token,
        status: "pending_review",
        page: 1,
      });
      assert.equal(pending.matched, 25);
      assert.equal(pending.rows[0].id, queue[0]);
      assert.equal(pending.rows[24].id, queue[25]);
      const last = await service.listSubmissionSummaries({
        q: token,
        status: "all",
        page: 2,
      });
      assert.equal(last.matched, 26);
      assert.deepEqual(
        last.rows.map((row) => row.id),
        [queue[1]],
      );
    } finally {
      now = originalNow;
    }
  });

  test("publishing rejects a stale review of either job content or public company details", async () => {
    const co = await company();
    const job = await draft(co.id);
    const review = {
      id: job.id,
      reviewToken: job.reviewToken,
      expiresAt: new Date(now.getTime() + 86_400_000).toISOString(),
      reviewed: true as const,
      reviewNotes: "Reviewed the whole listing before publishing.",
    };
    await service.saveJob(
      {
        id: job.id,
        expectedDraftVersion: job.draftVersion,
        companyId: co.id,
        content: content("A simultaneous editor change"),
      },
      actor,
    );
    await assert.rejects(
      service.publishJob(review, actor),
      (error: unknown) =>
        error instanceof JobboardError && error.code === "review_conflict",
    );
    review.reviewToken = (await service.getJob(job.id)).reviewToken;
    await service.saveCompany(
      {
        id: co.id,
        expectedUpdatedAt: co.updatedAt.toISOString(),
        name: "Changed public employer",
        website: co.website,
        description: co.description,
        contacts: co.contacts,
        notes: co.notes,
        terms: co.terms,
      },
      actor,
    );
    await assert.rejects(
      service.publishJob(review, actor),
      (error: unknown) =>
        error instanceof JobboardError && error.code === "review_conflict",
    );
    assert.equal((await service.getRevisions(job.id)).length, 0);
    assert.equal(await service.getPublicJob(job.id), null);
  });

  test("review tokens bind to a single job and company-only changes show unpublished work", async () => {
    const co = await company();
    const a = await draft(co.id);
    const b = await draft(co.id);
    assert.notEqual(a.reviewToken, b.reviewToken);
    await assert.rejects(
      service.publishJob(
        {
          id: b.id,
          reviewToken: a.reviewToken,
          expiresAt: new Date(now.getTime() + 86_400_000).toISOString(),
          reviewed: true,
          reviewNotes: "Reviewed a different position with this company.",
        },
        actor,
      ),
      (error: unknown) =>
        error instanceof JobboardError && error.code === "review_conflict",
    );
    await publish(a.id);
    assert.equal((await service.getJob(a.id)).hasUnpublishedChanges, false);
    await service.saveCompany(
      {
        id: co.id,
        expectedUpdatedAt: co.updatedAt.toISOString(),
        name: "Company details awaiting review",
        website: co.website,
        description: co.description,
        contacts: co.contacts,
        notes: co.notes,
        terms: co.terms,
      },
      actor,
    );
    assert.equal((await service.getJob(a.id)).hasUnpublishedChanges, true);
    assert.equal((await service.getPublicJob(a.id))?.company.name, co.name);
  });

  test("pause hides the entire listing while closed and expired roles retain a closed page", async () => {
    const co = await company();
    const job = await draft(co.id, `Unique expiry ${randomUUID()}`);
    await publish(job.id, new Date(now.getTime() + 1000).toISOString());
    assert.equal(
      (await service.listPublicJobs({ q: job.title })).jobs.length,
      1,
    );
    const originalNow = now;
    now = new Date(now.getTime() + 1001);
    assert.equal(
      (await service.listPublicJobs({ q: job.title })).jobs.length,
      0,
    );
    assert.equal((await service.getPublicJob(job.id))?.status, "closed");
    assert.equal((await service.getJob(job.id)).status, "expired");
    now = originalNow;
    await service.setJobStatus(job.id, "paused", actor);
    assert.equal(await service.getPublicJob(job.id), null);
    assert.equal((await service.getJob(job.id)).status, "paused");
    assert.equal(
      (await service.listPublicJobs({ q: job.title })).jobs.length,
      0,
    );
    await service.setJobStatus(job.id, "closed", actor);
    assert.equal((await service.getPublicJob(job.id))?.status, "closed");
  });

  test("public pagination is stable and searches approved content", async () => {
    const co = await company();
    const unique = `Pagination ${randomUUID()}`;
    const a = await draft(co.id, `${unique} A`);
    const b = await draft(co.id, `${unique} B`);
    await publish(a.id);
    await publish(b.id);
    const first = await service.listPublicJobs({ q: unique, limit: 1 });
    assert.equal(first.jobs.length, 1);
    assert.ok(first.nextCursor);
    const second = await service.listPublicJobs({
      q: unique,
      limit: 1,
      cursor: first.nextCursor,
    });
    assert.equal(second.jobs.length, 1);
    assert.notEqual(second.jobs[0].id, first.jobs[0].id);
    assert.equal(second.nextCursor, null);
    await service.saveJob(
      {
        id: a.id,
        expectedDraftVersion: a.draftVersion,
        companyId: co.id,
        content: content("Not approved search term"),
      },
      actor,
    );
    assert.equal((await service.listPublicJobs({ q: unique })).jobs.length, 2);
    assert.equal(
      (await service.listPublicJobs({ q: "Not approved search term" })).jobs
        .length,
      0,
    );
  });

  test("editing expiry preserves the draft and approved content while updating public reads and audit", async () => {
    const co = await company();
    const job = await draft(co.id, `Editable expiry ${randomUUID()}`);
    const published = await publish(job.id);
    const saved = await service.saveJob(
      {
        id: job.id,
        expectedDraftVersion: job.draftVersion,
        companyId: co.id,
        content: content("Private draft awaiting review"),
        notes: "Private notes awaiting review",
      },
      actor,
    );
    const revisionsBefore = await service.getRevisions(job.id);
    const expiresAt = new Date(now.getTime() + 90 * 86_400_000).toISOString();
    assert.ok(published.expiresAt && published.publishedAt);
    const changed = await service.editJobExpiry(
      {
        id: job.id,
        expiresAt,
        expectedExpiresAt: published.expiresAt.toISOString(),
        expectedPublishedAt: published.publishedAt.toISOString(),
      },
      actor,
    );
    assert.deepEqual(changed.content, saved.content);
    assert.equal(changed.notes, saved.notes);
    assert.equal(changed.draftVersion, saved.draftVersion);
    assert.equal(
      changed.publishedDraftVersion,
      published.publishedDraftVersion,
    );
    assert.equal(changed.hasUnpublishedChanges, true);
    assert.equal(changed.expiresAt?.toISOString(), expiresAt);
    assert.deepEqual(changed.published, { ...published.published, expiresAt });
    assert.deepEqual(await service.getRevisions(job.id), revisionsBefore);
    await assert.rejects(
      service.publishJob(
        {
          id: job.id,
          reviewToken: saved.reviewToken,
          expiresAt: published.expiresAt.toISOString(),
          reviewed: true,
          reviewNotes: "A review started before another editor changed expiry.",
        },
        actor,
      ),
      (error: unknown) =>
        error instanceof JobboardError && error.code === "review_conflict",
    );
    assert.equal((await service.getPublicJob(job.id))?.expiresAt, expiresAt);
    assert.equal(
      (await service.listPublicJobs({ q: job.title })).jobs[0]?.expiresAt,
      expiresAt,
    );
    assert.ok(
      (await service.getAudit({ entityId: job.id })).some(
        (row) =>
          row.eventType === "job.expiry_updated" &&
          row.description.includes(
            published.expiresAt?.toISOString() ?? "missing",
          ) &&
          row.description.includes(expiresAt) &&
          row.actorName === actor.name,
      ),
    );
    const originalNow = now;
    try {
      now = new Date(published.expiresAt.getTime() + 1);
      assert.equal((await service.getPublicJob(job.id))?.status, "active");
      now = new Date(expiresAt);
      assert.equal((await service.getPublicJob(job.id))?.status, "closed");
      assert.equal(
        (await service.listPublicJobs({ q: job.title })).jobs.length,
        0,
      );
    } finally {
      now = originalNow;
    }
  });

  test("expiry changes cannot reopen drafts, paused, closed or expired jobs", async () => {
    const co = await company();
    for (const status of ["draft", "paused", "closed", "expired"] as const) {
      const job = await draft(co.id);
      const published = await publish(job.id);
      assert.ok(published.expiresAt && published.publishedAt);
      const originalNow = now;
      try {
        if (status === "expired") now = new Date(published.expiresAt);
        else await service.setJobStatus(job.id, status, actor);
        await assert.rejects(
          service.editJobExpiry(
            {
              id: job.id,
              expiresAt: new Date(now.getTime() + 86_400_000).toISOString(),
              expectedExpiresAt: published.expiresAt.toISOString(),
              expectedPublishedAt: published.publishedAt.toISOString(),
            },
            actor,
          ),
          (error: unknown) =>
            error instanceof JobboardError &&
            error.code === "invalid_transition",
        );
        const publicJob = await service.getPublicJob(job.id);
        if (status === "draft" || status === "paused")
          assert.equal(publicJob, null);
        else assert.equal(publicJob?.status, "closed");
      } finally {
        now = originalNow;
      }
    }
  });

  test("concurrent expiry changes and a newly published version reject stale expiry forms", async () => {
    const co = await company();
    const job = await draft(co.id);
    const published = await publish(job.id);
    assert.ok(published.expiresAt && published.publishedAt);
    const input = {
      id: job.id,
      expiresAt: new Date(now.getTime() + 90 * 86_400_000).toISOString(),
      expectedExpiresAt: published.expiresAt.toISOString(),
      expectedPublishedAt: published.publishedAt.toISOString(),
    };
    const results = await Promise.allSettled([
      service.editJobExpiry(input, actor),
      service.editJobExpiry(
        {
          ...input,
          expiresAt: new Date(now.getTime() + 120 * 86_400_000).toISOString(),
        },
        actor,
      ),
    ]);
    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1,
    );
    const rejected = results.find((result) => result.status === "rejected");
    assert.ok(rejected?.status === "rejected");
    assert.ok(rejected.reason instanceof JobboardError);
    assert.equal(rejected.reason.code, "expiry_conflict");

    const beforeRepublish = await service.getJob(job.id);
    assert.ok(beforeRepublish.expiresAt && beforeRepublish.publishedAt);
    const originalNow = now;
    try {
      now = new Date(now.getTime() + 1);
      await publish(job.id, beforeRepublish.expiresAt.toISOString());
      await assert.rejects(
        service.editJobExpiry(
          {
            ...input,
            expectedExpiresAt: beforeRepublish.expiresAt.toISOString(),
            expectedPublishedAt: beforeRepublish.publishedAt.toISOString(),
          },
          actor,
        ),
        (error: unknown) =>
          error instanceof JobboardError && error.code === "expiry_conflict",
      );
    } finally {
      now = originalNow;
    }
  });

  test("expiry changes allow shortening but reject past or excessively distant dates without mutation", async () => {
    const co = await company();
    const job = await draft(co.id);
    const published = await publish(job.id);
    assert.ok(published.expiresAt && published.publishedAt);
    const input = {
      id: job.id,
      expiresAt: published.expiresAt.toISOString(),
      expectedExpiresAt: published.expiresAt.toISOString(),
      expectedPublishedAt: published.publishedAt.toISOString(),
    };
    for (const expiresAt of [
      now.toISOString(),
      new Date(now.getTime() + 366 * 86_400_000).toISOString(),
    ]) {
      await assert.rejects(
        service.editJobExpiry({ ...input, expiresAt }, actor),
        (error: unknown) =>
          error instanceof JobboardError && error.code === "invalid_expiry",
      );
    }
    const auditBefore = await service.getAudit({ entityId: job.id });
    await service.editJobExpiry(input, actor);
    assert.deepEqual(await service.getAudit({ entityId: job.id }), auditBefore);
    const expiresAt = new Date(now.getTime() + 86_400_000).toISOString();
    const changed = await service.editJobExpiry({ ...input, expiresAt }, actor);
    assert.equal(changed.expiresAt?.toISOString(), expiresAt);
  });

  test("submission retries and concurrent acceptance create one draft without overwriting company data", async () => {
    const co = await company();
    const payload = submission();
    const results = await Promise.all([
      service.submitJob(payload),
      service.submitJob(payload),
    ]);
    assert.equal(results[0].id, results[1].id);
    submissionIds.push(results[0].id);
    await assert.rejects(
      service.submitJob({ ...payload, job: content("Changed retry payload") }),
      (error: unknown) =>
        error instanceof JobboardError && error.code === "idempotency_conflict",
    );
    const [a, b] = await Promise.all([
      service.acceptSubmission(results[0].id, co.id, actor),
      service.acceptSubmission(results[0].id, co.id, actor),
    ]);
    jobIds.push(a.id);
    assert.equal(a.id, b.id);
    assert.equal(a.status, "draft");
    assert.equal(await service.getPublicJob(a.id), null);
    assert.deepEqual((await service.getCompany(co.id)).contacts, co.contacts);
    assert.equal((await service.getCompany(co.id)).name, co.name);
    assert.equal(
      (await service.listSubmissions()).find((row) => row.id === results[0].id)
        ?.status,
      "accepted",
    );
  });

  test("unknown company acceptance rolls back and rejected submissions cannot become drafts", async () => {
    const row = await service.submitJob(submission());
    submissionIds.push(row.id);
    await assert.rejects(
      service.acceptSubmission(row.id, "jbc_missing", actor),
    );
    assert.equal(
      (await service.listSubmissions()).find((item) => item.id === row.id)
        ?.status,
      "pending_review",
    );
    await service.rejectSubmission(
      row.id,
      "The employer information could not be verified.",
      actor,
    );
    const co = await company();
    await assert.rejects(service.acceptSubmission(row.id, co.id, actor));
    assert.equal(
      (await service.listSubmissions()).find((item) => item.id === row.id)
        ?.jobId,
      null,
    );
  });

  test("concurrent metrics retries count once, validate references and atomically roll back invalid batches", async () => {
    const co = await company();
    const job = await draft(co.id);
    await publish(job.id);
    const one = event(job.id);
    const two = event(job.id);
    const responses = await Promise.all([
      service.recordMetrics({ events: [one, two] }),
      service.recordMetrics({ events: [two, one] }),
    ]);
    assert.equal(
      responses.reduce((sum, row) => sum + row.accepted, 0),
      2,
    );
    const analytics = await service.getAnalytics();
    assert.equal(
      analytics.jobs.find((row) => row.jobId === job.id)?.jobViews,
      2,
    );
    assert.deepEqual(
      Object.keys(
        (
          await db
            .select()
            .from(jobboardMetricReceipt)
            .where(eq(jobboardMetricReceipt.eventId, one.eventId))
        )[0],
      ).sort(),
      ["createdAt", "eventId"],
    );
    const valid = event(job.id);
    const invalid = event("jbj_never_published");
    await assert.rejects(service.recordMetrics({ events: [valid, invalid] }));
    assert.equal(
      (
        await db
          .select()
          .from(jobboardMetricReceipt)
          .where(eq(jobboardMetricReceipt.eventId, valid.eventId))
      ).length,
      0,
    );
    await assert.rejects(
      service.recordMetrics({
        events: [
          {
            ...event(job.id),
            occurredAt: new Date(now.getTime() - 86_400_001).toISOString(),
          },
        ],
      }),
    );
    await assert.rejects(
      service.recordMetrics({
        events: [
          {
            ...event(job.id),
            occurredAt: new Date(now.getTime() + 300_001).toISOString(),
          },
        ],
      }),
    );
    assert.equal(
      (await service.getAnalytics()).jobs.find((row) => row.jobId === job.id)
        ?.jobViews,
      2,
    );
  });

  test("full metrics batches remain atomic across concurrent retries and duplicate IDs within one batch", async () => {
    const co = await company();
    const job = await draft(co.id);
    await publish(job.id);
    const events = Array.from({ length: 100 }, () => event(job.id));
    const results = await Promise.all([
      service.recordMetrics({ events }),
      service.recordMetrics({ events: [...events].reverse() }),
    ]);
    assert.equal(
      results.reduce((sum, result) => sum + result.accepted, 0),
      100,
    );
    const duplicate = event(job.id);
    assert.equal(
      (await service.recordMetrics({ events: [duplicate, duplicate] }))
        .accepted,
      1,
    );
    assert.equal(
      (await service.recordMetrics({ events: [duplicate] })).accepted,
      0,
    );
    assert.equal(
      (await service.getAnalytics()).jobs.find((row) => row.jobId === job.id)
        ?.jobViews,
      101,
    );
  });

  test("service rate windows enforce a shared limit across concurrent callers", async () => {
    const limited = createJobboardService(
      db,
      () => new Date("2032-01-01T00:00:00Z"),
    );
    const outcomes = await Promise.allSettled(
      Array.from({ length: 32 }, () => limited.consumeServiceBudget("submit")),
    );
    assert.equal(
      outcomes.filter((row) => row.status === "fulfilled").length,
      30,
    );
    const rejected = outcomes.filter((row) => row.status === "rejected");
    assert.equal(rejected.length, 2);
    for (const result of rejected) {
      assert.ok(result.reason instanceof JobboardError);
      assert.equal(result.reason.retryAfterSeconds, 60);
    }
  });

  test("the authenticated HTTP contract works with the real database and denies escalation", async () => {
    const co = await company();
    const job = await draft(co.id);
    await publish(job.id);
    const response = await api.job(
      new Request(`http://localhost/api/jobboard/v1/jobs/${job.id}`, {
        headers: { authorization: `Bearer ${keys.read}` },
      }),
      job.id,
    );
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.version, "1");
    assert.equal(data.job.id, job.id);
    assert.doesNotMatch(JSON.stringify(data), /PRIVATE|contacts|terms/);
    const body = submission();
    const committed: string[] = [];
    const submissionApi = createJobboardHttp(
      service,
      () => keys,
      (id) => {
        committed.push(id);
      },
    );
    const posted = await submissionApi.submissions(
      new Request("http://localhost/api/jobboard/v1/submissions", {
        method: "POST",
        headers: {
          authorization: `Bearer ${keys.submit}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      }),
    );
    assert.equal(posted.status, 202);
    const acknowledgement = await posted.json();
    submissionIds.push(acknowledgement.id);
    assert.deepEqual(committed, [acknowledgement.id]);
    const denied = await submissionApi.submissions(
      new Request("http://localhost/api/jobboard/v1/submissions", {
        method: "POST",
        headers: {
          authorization: `Bearer ${keys.submit}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ ...body, publish: true }),
      }),
    );
    assert.equal(denied.status, 422);
    assert.deepEqual(committed, [acknowledgement.id]);
  });

  test("maintenance prunes dedupe receipts and old aggregates without removing recent counts", async () => {
    const co = await company();
    const job = await draft(co.id);
    await publish(job.id);
    const recent = event(job.id);
    await service.recordMetrics({ events: [recent] });
    const oldId = randomUUID();
    eventIds.push(oldId);
    await db.insert(jobboardMetricReceipt).values({
      eventId: oldId,
      createdAt: new Date(now.getTime() - 49 * 3_600_000),
    });
    const lastReceived = await service.latestMetricReceipt();
    assert.ok(lastReceived && lastReceived >= now);
    const afterRetention = createJobboardService(
      db,
      () => new Date(lastReceived.getTime() + 48 * 3_600_000 + 1),
    );
    assert.equal(await afterRetention.latestMetricReceipt(), null);
    await db.insert(jobboardMetricDaily).values({
      day: "2020-01-01",
      jobId: job.id,
      type: "detail_request",
      surface: "standalone",
      source: "unknown",
      count: 100,
    });
    const result = await service.runMaintenance();
    assert.ok(result.receiptsRemoved >= 1);
    assert.ok(result.aggregateRowsRemoved >= 1);
    const retry = await service.runMaintenance();
    assert.equal(retry.receiptsRemoved, 0);
    assert.equal(retry.aggregateRowsRemoved, 0);
    assert.equal(
      (
        await db
          .select()
          .from(jobboardMetricReceipt)
          .where(eq(jobboardMetricReceipt.eventId, oldId))
      ).length,
      0,
    );
    assert.equal(
      (
        await db
          .select()
          .from(jobboardMetricReceipt)
          .where(eq(jobboardMetricReceipt.eventId, recent.eventId))
      ).length,
      1,
    );
    assert.equal(
      (
        await db
          .select()
          .from(jobboardMetricDaily)
          .where(
            and(
              eq(jobboardMetricDaily.jobId, job.id),
              eq(jobboardMetricDaily.day, "2020-01-01"),
            ),
          )
      ).length,
      0,
    );
    assert.equal(
      (await service.getAnalytics()).jobs.find((row) => row.jobId === job.id)
        ?.jobViews,
      1,
    );
  });
});
