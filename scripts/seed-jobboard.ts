import "dotenv/config";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  createJobboardService,
  type JobboardCompany,
} from "../src/internal-apps/jobboard/db/service";
import {
  type JobContent,
  jobContentSchema,
} from "../src/internal-apps/jobboard/lib/contracts";

const url = new URL(process.env.DATABASE_URL ?? "");
if (
  process.env.NODE_ENV === "production" ||
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  !/^\/(jobboard_test|jobboard_dev)$/.test(url.pathname)
) {
  throw new Error(
    "Seed only supports local jobboard_test or jobboard_dev databases. No records were changed.",
  );
}
const pool = new Pool({ connectionString: url.href, max: 2 });
const service = createJobboardService(drizzle(pool));
const actor = { id: null, name: "Local demo seed" };

async function main() {
  for (const [id, email, role] of [
    ["usr_jobboard_demo_admin", "jobboard-admin@example.test", "admin"],
    [
      "usr_jobboard_demo_editor",
      "jobboard-editor@example.test",
      "jobboard_editor",
    ],
    ["usr_jobboard_demo_member", "jobboard-member@example.test", null],
  ] as const) {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO "user" (id, name, email, email_verified, first_name, last_name, personal_email, phone, birth_date, status, department, event_email_preference) VALUES ($1, 'Jobboard Demo', $2, true, 'Jobboard', 'Demo', $2, '+4915112345678', '2000-01-01', 'member', 'operations', 'personal_email') ON CONFLICT (email) DO UPDATE SET phone=EXCLUDED.phone, birth_date=EXCLUDED.birth_date, event_email_preference=EXCLUDED.event_email_preference RETURNING id`,
      [id, email],
    );
    if (role)
      await pool.query(
        'INSERT INTO user_access_grant (user_id, "grant") VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [result.rows[0].id, role],
      );
  }

  const existing = await service.listCompanies();
  const names = [
    "Northstar Labs (demo)",
    "Common Ground (demo)",
    "Fieldwork Ventures (demo)",
  ];
  const companies: JobboardCompany[] = [];
  for (const name of names) {
    companies.push(
      existing.find((item) => item.name === name) ??
        (await service.saveCompany(
          {
            name,
            website: "https://example.com",
            description:
              "A fictional company used to demonstrate the START Jobboard. These are not real vacancies.",
            notes: "PRIVATE_DEMO_NOTE: internal partner context.",
            terms: "Free partner benefit. No paid commitment.",
            contacts: [
              {
                name: "Demo Hiring Team",
                email: "hiring@example.test",
                role: "Hiring contact",
                phone: "",
                notes: "PRIVATE_DEMO_CONTACT",
              },
            ],
          },
          actor,
        )),
    );
  }
  const roles: Array<Partial<JobContent> & { title: string }> = [
    {
      title: "Founding Product Engineer",
      employmentType: "full_time",
      seniority: "senior",
      salaryMin: 70000,
      salaryMax: 90000,
    },
    {
      title: "Working Student, Growth",
      employmentType: "working_student",
      seniority: "entry",
      salaryMin: 18,
      salaryMax: 22,
      salaryPeriod: "hour",
      weeklyHours: 20,
    },
    {
      title: "Venture Capital Analyst",
      employmentType: "full_time",
      seniority: "entry",
      salaryMin: 48000,
      salaryMax: 58000,
    },
    {
      title: "Senior Product Designer",
      employmentType: "full_time",
      seniority: "senior",
      remoteMode: "remote",
      locations: ["Germany"],
      salaryMin: 65000,
      salaryMax: 80000,
    },
    {
      title: "Founder’s Associate Intern",
      employmentType: "internship",
      seniority: "entry",
      salaryMin: 2500,
      salaryMax: 3000,
      salaryPeriod: "month",
      internshipDurationMonths: 6,
    },
    {
      title: "Community Operations Lead",
      employmentType: "part_time",
      seniority: "lead",
      salaryStatus: "not_disclosed",
      salaryMin: null,
      salaryMax: null,
      weeklyHours: 25,
    },
    {
      title: "Climate Research Associate",
      employmentType: "contract",
      seniority: "mid",
      locations: ["Amsterdam"],
      countryCodes: ["NL"],
      salaryMin: 55000,
      salaryMax: 65000,
    },
  ];
  const jobs = await service.listJobs();
  for (const [index, role] of roles.entries()) {
    if (
      jobs.some(
        (job) =>
          job.title === role.title &&
          job.companyId === companies[index % companies.length].id,
      )
    )
      continue;
    const content = jobContentSchema.parse({
      description:
        "This is a demonstration vacancy, not a real opportunity.\n\nWork with a small, curious team building products that make everyday work better. You will shape the product with the founders and work directly with customers.\n\nWhat you will do\nOwn a meaningful area of the product, collaborate with people from different backgrounds, and share what you learn.\n\nWhat you bring\nClear communication, thoughtful work, and curiosity. We welcome different paths into the field.\n\nThe team offers flexible working arrangements and time to develop your skills. The external application link points to an example website.",
      employmentType: "full_time",
      seniority: "mid",
      locations: ["Berlin"],
      countryCodes: ["DE"],
      remoteMode: "hybrid",
      languages: ["English"],
      applyUrl: "https://example.com/careers",
      salaryStatus: "disclosed",
      salaryMin: 50000,
      salaryMax: 65000,
      salaryCurrency: "EUR",
      salaryPeriod: "year",
      weeklyHours: 40,
      internshipDurationMonths: null,
      ...role,
    });
    const job = await service.saveJob(
      {
        companyId: companies[index % companies.length].id,
        content,
        notes: "Demo role only.",
      },
      actor,
    );
    await service.publishJob(
      {
        id: job.id,
        reviewToken: job.reviewToken,
        reviewed: true,
        reviewNotes:
          "Local demonstration content reviewed. Fictional employer and role; not a production publication.",
        expiresAt: new Date(Date.now() + 60 * 86_400_000).toISOString(),
      },
      actor,
    );
  }
  const all = await service.listJobs();
  const analytics = await service.getAnalytics();
  if (analytics.totals.boardRequests === 0) {
    for (let day = 0; day < 12; day++) {
      // Metrics intake intentionally rejects historical replay. Only today's
      // local demonstration events are seeded through the actual service.
      const job = all[day % all.length];
      await service.recordMetrics({
        events: [
          {
            eventId: randomUUID(),
            occurredAt: new Date().toISOString(),
            type: "board_request",
            jobId: null,
            surface: "standalone",
            source: "website",
          },
          {
            eventId: randomUUID(),
            occurredAt: new Date().toISOString(),
            type: "detail_request",
            jobId: job.id,
            surface: "standalone",
            source: "website",
          },
          {
            eventId: randomUUID(),
            occurredAt: new Date().toISOString(),
            type: "apply_redirect",
            jobId: job.id,
            surface: "standalone",
            source: day % 2 ? "linkedin" : "website",
          },
        ],
      });
    }
  }
  const pendingDemo = (await service.listSubmissions()).some(
    (submission) =>
      submission.status === "pending_review" &&
      submission.payload.company.name === "New Network Partner (demo)" &&
      submission.payload.company.website === "https://example.org" &&
      submission.payload.contact.email === "hiring@example.test",
  );
  if (!pendingDemo) {
    const demoJob = all.find(
      (job) =>
        job.companyId === companies[0].id && job.title === roles[0].title,
    );
    if (!demoJob)
      throw new Error("A seeded role is required for the demo submission.");
    await service.submitJob({
      requestId: randomUUID(),
      company: {
        name: "New Network Partner (demo)",
        website: "https://example.org",
        description: "A fictional employer submission for review.",
      },
      contact: {
        name: "Hiring team",
        email: "hiring@example.test",
        role: "Recruiter",
        phone: "",
        notes: "",
      },
      job: demoJob.content,
      permissionToPublish: true,
    });
  }
  console.log(
    "Local Jobboard demo ready: fictional roles, one pending submission and three test accounts.",
  );
  console.log(
    "Use jobboard-admin@example.test, jobboard-editor@example.test or jobboard-member@example.test with local dev login.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
