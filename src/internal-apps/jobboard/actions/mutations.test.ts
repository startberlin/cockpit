import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { it } from "node:test";
import type { ZodType } from "zod";
import type { UserAuthority } from "@/lib/authority/model";
import { evaluateAuth, type GlobalAction } from "@/lib/permissions/evaluate";
import { JobboardError } from "../db/service";

it("checks the current account on every direct editorial and publication action", async (t) => {
  const member: UserAuthority = {
    userId: "editor",
    status: "member",
    department: "events",
    positions: [],
    grants: [],
  };
  let current: UserAuthority | null = member;
  const writes: Array<{ method: string; args: unknown[] }> = [];
  function record(method: string) {
    return async (...args: unknown[]) => {
      writes.push({ method, args });
      return { id: "test-job", draftVersion: 1, updatedAt: new Date() };
    };
  }
  const service = {
    publishJob: record("publishJob"),
    editJobExpiry: record("editJobExpiry"),
    setJobStatus: record("setJobStatus"),
    acceptSubmission: record("acceptSubmission"),
    rejectSubmission: record("rejectSubmission"),
    deleteCompany: record("deleteCompany"),
    saveJob: record("saveJob"),
    saveCompany: record("saveCompany"),
    getSubmissionReview: async () => ({
      submission: { status: "pending_review" },
    }),
    listCompanyOptions: async () => [],
  };
  // Exercise the action handlers and their real schemas without Next.js networking or a database.
  const actionClient = {
    inputSchema: (schema: ZodType) => ({
      action:
        (handler: (args: unknown) => Promise<unknown>) => (input: unknown) =>
          handler({
            parsedInput: schema.parse(input),
            ctx: { user: { id: member.userId, name: "Editor" } },
          }),
    }),
  };
  const load = createRequire(import.meta.url);
  type ModuleLoader = (
    request: string,
    parent: NodeModule,
    isMain: boolean,
  ) => unknown;
  const modules = load("node:module") as { _load: ModuleLoader };
  const original = modules._load;
  const stub = t.mock.method(
    modules,
    "_load",
    (request: string, parent: NodeModule, isMain: boolean) => {
      if (parent.filename.endsWith("/jobboard/actions/mutations.ts")) {
        if (request === "./client")
          return { jobboardActionClient: actionClient };
        if (request === "../lib/service") return { service, JobboardError };
        if (request === "next/cache") return { revalidatePath: () => {} };
        if (request === "@/lib/permissions/server")
          return {
            can: async (action: GlobalAction) =>
              current ? evaluateAuth(current, action) : false,
          };
      }
      return original.call(modules, request, parent, isMain);
    },
  );
  const api = load("./mutations.ts") as Record<
    string,
    (input: unknown) => Promise<unknown>
  >;
  stub.mock.restore();

  const id = "test-job";
  const expiresAt = "2027-05-01T00:00:00.000Z";
  const transitions = [
    () =>
      api.publishJobAction({
        id,
        expiresAt,
        reviewed: true,
        reviewToken: "a".repeat(64),
        reviewNotes: "Reviewed before publishing.",
      }),
    () =>
      api.editJobExpiryAction({
        id,
        expiresAt,
        expectedExpiresAt: expiresAt,
        expectedPublishedAt: "2026-11-18T08:00:00.000Z",
      }),
    () => api.setJobStatusAction({ id, status: "paused" }),
    () => api.setJobStatusAction({ id, status: "draft" }),
  ];
  const close = () => api.setJobStatusAction({ id, status: "closed" });
  const companyId = "test-company";
  const content = {
    title: "Software engineer",
    description: "Develop applications with our engineering team in Berlin.",
    employmentType: "full_time",
    seniority: "mid",
    locations: ["Berlin"],
    countryCodes: ["DE"],
    remoteMode: "onsite",
    languages: ["English"],
    applyUrl: "https://example.com/jobs/engineer",
    salaryStatus: "not_disclosed",
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: "EUR",
    salaryPeriod: "year",
    weeklyHours: null,
    internshipDurationMonths: null,
  };
  const editorial = [
    () => api.acceptSubmissionAction({ id, companyId }),
    () => api.rejectSubmissionAction({ id, note: "Duplicate role." }),
    () => api.loadSubmissionReviewAction({ id }),
    () => api.refreshCompaniesAction({ q: "" }),
    () =>
      api.saveCompanyAction({
        name: "Test company",
        website: "https://example.com",
        description: "",
        contacts: [],
      }),
    () => api.saveJobAction({ companyId, content }),
    () => api.deleteCompanyAction({ id: companyId }),
  ];
  const denied = { code: "forbidden" };

  for (const position of ["department_head", "department_co_lead"] as const) {
    current = {
      ...member,
      positions: [
        { position, scope: "department", department: "partnerships" },
      ],
    };
    for (const act of transitions) await act();
    await close();
    assert.equal(writes.at(-1)?.args[1], "closed");
    for (const act of editorial) await act();
  }
  for (const grant of ["admin", "super_admin"] as const) {
    current = { ...member, grants: [{ grant }] };
    for (const act of transitions) await act();
    await close();
    assert.equal(writes.at(-1)?.args[1], "closed");
  }

  for (const editor of [
    { ...member, department: "partnerships" as const },
    { ...member, grants: [{ grant: "jobboard_editor" as const }] },
  ]) {
    current = editor;
    for (const act of editorial) await act();
    await close();
    assert.equal(writes.at(-1)?.args[1], "archive_draft");
    const before = writes.length;
    for (const act of transitions) await assert.rejects(act(), denied);
    assert.equal(writes.length, before);
  }

  for (const revoked of [
    member,
    {
      ...member,
      positions: [{ scope: "global", position: "president" }],
    } satisfies UserAuthority,
    {
      ...member,
      status: "alumni",
      grants: [{ grant: "super_admin" }],
    } satisfies UserAuthority,
    null,
  ]) {
    current = revoked;
    const before = writes.length;
    for (const act of [...transitions, close, ...editorial])
      await assert.rejects(act(), denied);
    assert.equal(writes.length, before);
  }
});
