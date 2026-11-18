import { z } from "zod";

/** Versioned wire contract. Copied verbatim into the independent public app. */
export const API_VERSION = "1" as const;
export const employmentTypes = [
  "full_time",
  "part_time",
  "contract",
  "internship",
  "working_student",
  "temporary",
  "volunteer",
  "other",
] as const;
export const seniorities = ["entry", "mid", "senior", "lead", "all"] as const;
export const jobStatuses = [
  "draft",
  "published",
  "paused",
  "closed",
  "expired",
] as const;
export const sources = [
  "direct",
  "website",
  "widget",
  "whatsapp",
  "linkedin",
  "newsletter",
  "unknown",
] as const;
export const metricTypes = [
  "board_request",
  "detail_request",
  "widget_request",
  "apply_redirect",
  "share_redirect",
] as const;

export function isSafePublicUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return false;
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (
      !host.includes(".") ||
      host.includes(":") ||
      host.startsWith("[") ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host.endsWith(".internal")
    )
      return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return false;
    return !Array.from(value).some((character) => {
      const code = character.charCodeAt(0);
      return code <= 32 || code === 127;
    });
  } catch {
    return false;
  }
}

export const publicUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine(
    isSafePublicUrl,
    "Use a public HTTP or HTTPS URL without credentials.",
  );
export const publicCompanySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(2).max(160),
    website: publicUrlSchema,
    description: z.string().trim().max(4000),
  })
  .strict();
export const companyInputSchema = publicCompanySchema
  .omit({ id: true })
  .extend({
    notes: z.string().trim().max(10000).default(""),
    terms: z.string().trim().max(10000).default(""),
  });
export const contactInputSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    email: z.email().max(254),
    role: z.string().trim().max(160).default(""),
    phone: z.string().trim().max(80).default(""),
    notes: z.string().trim().max(4000).default(""),
  })
  .strict();

export const jobContentSchema = z
  .object({
    title: z.string().trim().min(3).max(180),
    description: z.string().trim().min(40).max(20000),
    employmentType: z.enum(employmentTypes),
    seniority: z.enum(seniorities),
    locations: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
    countryCodes: z
      .array(z.string().regex(/^[A-Z]{2}$/, "Use a two-letter country code."))
      .min(1)
      .max(30),
    remoteMode: z.enum(["onsite", "hybrid", "remote"]),
    languages: z.array(z.string().trim().min(1).max(60)).min(1).max(10),
    applyUrl: publicUrlSchema,
    salaryStatus: z.enum(["disclosed", "not_disclosed", "unpaid"]),
    salaryMin: z.number().finite().positive().nullable(),
    salaryMax: z.number().finite().positive().nullable(),
    salaryCurrency: z.string().regex(/^[A-Z]{3}$/),
    salaryPeriod: z.enum(["hour", "month", "year"]),
    weeklyHours: z.number().positive().max(168).nullable(),
    internshipDurationMonths: z.number().positive().max(60).nullable(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.salaryStatus === "disclosed" && value.salaryMin === null)
      ctx.addIssue({
        code: "custom",
        path: ["salaryMin"],
        message: "Enter a salary amount or lower bound.",
      });
    if (
      value.salaryMin !== null &&
      value.salaryMax !== null &&
      value.salaryMax < value.salaryMin
    )
      ctx.addIssue({
        code: "custom",
        path: ["salaryMax"],
        message: "The upper bound must be at least the lower bound.",
      });
    if (
      value.salaryStatus !== "disclosed" &&
      (value.salaryMin !== null || value.salaryMax !== null)
    )
      ctx.addIssue({
        code: "custom",
        path: ["salaryMin"],
        message: "Only disclosed compensation can contain an amount.",
      });
  });
export type JobContent = z.infer<typeof jobContentSchema>;
export type CompanyInput = z.infer<typeof companyInputSchema>;
export type ContactInput = z.infer<typeof contactInputSchema>;

export const publicJobSchema = z
  .object({
    id: z.string().min(1),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    content: jobContentSchema,
    company: publicCompanySchema,
    status: z.enum(["active", "closed"]),
    publishedAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
  })
  .strict();
export type PublicJob = z.infer<typeof publicJobSchema>;
export const jobListResponseSchema = z
  .object({
    version: z.literal(API_VERSION),
    jobs: z.array(publicJobSchema),
    nextCursor: z.string().nullable(),
  })
  .strict();
export const jobDetailResponseSchema = z
  .object({ version: z.literal(API_VERSION), job: publicJobSchema })
  .strict();
export const submissionInputSchema = z
  .object({
    requestId: z.uuid(),
    company: publicCompanySchema.omit({ id: true }),
    contact: contactInputSchema,
    job: jobContentSchema,
    permissionToPublish: z.literal(true),
  })
  .strict();
export type SubmissionInput = z.infer<typeof submissionInputSchema>;
export const submissionResponseSchema = z
  .object({
    version: z.literal(API_VERSION),
    id: z.string(),
    status: z.literal("pending_review"),
  })
  .strict();
export const metricEventSchema = z
  .object({
    eventId: z.uuid(),
    occurredAt: z.iso.datetime(),
    type: z.enum(metricTypes),
    jobId: z.string().min(1).max(80).nullable(),
    surface: z.enum(["standalone", "widget"]),
    source: z.enum(sources),
  })
  .strict()
  .superRefine((event, ctx) => {
    if (
      ["detail_request", "apply_redirect", "share_redirect"].includes(
        event.type,
      ) &&
      !event.jobId
    )
      ctx.addIssue({
        code: "custom",
        path: ["jobId"],
        message: "A job is required for this event.",
      });
  });
export type MetricEvent = z.infer<typeof metricEventSchema>;
export const metricsInputSchema = z
  .object({ events: z.array(metricEventSchema).min(1).max(100) })
  .strict();
export const metricsResponseSchema = z
  .object({
    version: z.literal(API_VERSION),
    accepted: z.number().int().nonnegative(),
  })
  .strict();
export const apiErrorSchema = z
  .object({
    version: z.literal(API_VERSION),
    error: z.object({ code: z.string(), message: z.string() }).strict(),
  })
  .strict();

export const publishInputSchema = z
  .object({
    reviewToken: z
      .string()
      .regex(/^[a-f0-9]{64}$/, "Reload the reviewed draft before publishing."),
    expiresAt: z.iso.datetime(),
    reviewed: z.literal(true, {
      error: "Confirm that the complete listing has been reviewed.",
    }),
    reviewNotes: z.string().trim().min(10).max(5000),
  })
  .strict();
export type PublishInput = z.infer<typeof publishInputSchema>;
