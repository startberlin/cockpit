import { z } from "zod";
import type { createJobboardService } from "../db/service";
import { JobboardError } from "../db/service";
import { type CompanyIcon, companyFaviconResponse } from "./company-favicon";
import {
  API_VERSION,
  apiErrorSchema,
  employmentTypes,
  jobDetailResponseSchema,
  jobListResponseSchema,
  metricsInputSchema,
  metricsResponseSchema,
  submissionInputSchema,
  submissionResponseSchema,
} from "./contracts";
import {
  type ServiceKeys,
  type ServiceScope,
  verifyServiceAuthorization,
} from "./service-auth";

const MAX_BODY_BYTES = 65_536;
const responseHeaders = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
const listQuerySchema = z
  .object({
    cursor: z.string().min(1).max(80).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    q: z.string().trim().max(200).optional(),
    employmentType: z.enum(employmentTypes).optional(),
    remoteMode: z.enum(["onsite", "hybrid", "remote"]).optional(),
  })
  .strict();

export async function readBoundedJson(request: Request): Promise<unknown> {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  ) {
    throw new JobboardError(
      "unsupported_media_type",
      "Use application/json.",
      415,
    );
  }
  const length = request.headers.get("content-length");
  if (
    length !== null &&
    (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)
  ) {
    throw new JobboardError(
      "payload_too_large",
      "The request body exceeds 64 KiB.",
      413,
    );
  }
  if (!request.body)
    throw new JobboardError("invalid_json", "A JSON body is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new JobboardError(
          "payload_too_large",
          "The request body exceeds 64 KiB.",
          413,
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new JobboardError(
      "invalid_json",
      "The request body must contain valid JSON.",
    );
  }
}

type PublicService = Pick<
  ReturnType<typeof createJobboardService>,
  | "listPublicJobs"
  | "getPublicJob"
  | "getPublishedCompanyWebsite"
  | "submitJob"
  | "recordMetrics"
  | "consumeServiceBudget"
>;

/** Transport logic stays dependency-injected so requests can be tested against an isolated DB. */
export function createJobboardHttp(
  service: PublicService,
  keys: () => ServiceKeys,
) {
  const json = (value: unknown, status = 200) =>
    Response.json(value, { status, headers: responseHeaders });
  const handle = async (
    request: Request,
    scope: ServiceScope,
    work: () => Promise<Response>,
  ) => {
    if (
      !verifyServiceAuthorization(
        request.headers.get("authorization"),
        scope,
        keys(),
      )
    ) {
      return json(
        apiErrorSchema.parse({
          version: API_VERSION,
          error: {
            code: "unauthorized",
            message: "A valid service credential is required.",
          },
        }),
        401,
      );
    }
    try {
      return await work();
    } catch (error) {
      if (error instanceof JobboardError)
        return json(
          {
            version: API_VERSION,
            error: { code: error.code, message: error.message },
          },
          error.status,
        );
      if (error instanceof z.ZodError)
        return json(
          {
            version: API_VERSION,
            error: {
              code: "invalid_request",
              message: "The request does not match the v1 API contract.",
            },
          },
          422,
        );
      // Do not log bodies, credentials, contact data, or database error details.
      console.error("[jobboard-api] Request failed.");
      return json(
        {
          version: API_VERSION,
          error: {
            code: "internal_error",
            message: "The jobboard is temporarily unavailable.",
          },
        },
        500,
      );
    }
  };
  return {
    jobs: (request: Request) =>
      handle(request, "read", async () => {
        const params = new URL(request.url).searchParams;
        if ([...params.keys()].some((key) => params.getAll(key).length !== 1))
          throw new JobboardError(
            "invalid_query",
            "Query parameters must not be repeated.",
          );
        const input = listQuerySchema.parse(Object.fromEntries(params));
        const result = await service.listPublicJobs(input);
        return json(
          jobListResponseSchema.parse({ version: API_VERSION, ...result }),
        );
      }),
    favicon: (
      request: Request,
      id: string,
      load: (host: string) => Promise<CompanyIcon | null>,
    ) =>
      handle(request, "read", async () => {
        if (!/^[A-Za-z0-9_-]{1,80}$/.test(id))
          throw new JobboardError("not_found", "Job not found.", 404);
        const website = await service.getPublishedCompanyWebsite(id);
        if (!website)
          throw new JobboardError("not_found", "Job not found.", 404);
        return companyFaviconResponse(request, website, load);
      }),
    job: (request: Request, id: string) =>
      handle(request, "read", async () => {
        if (!/^[A-Za-z0-9_-]{1,80}$/.test(id))
          throw new JobboardError("not_found", "Job not found.", 404);
        const job = await service.getPublicJob(id);
        if (!job) throw new JobboardError("not_found", "Job not found.", 404);
        return json(
          jobDetailResponseSchema.parse({ version: API_VERSION, job }),
        );
      }),
    submissions: (request: Request) =>
      handle(request, "submit", async () => {
        const input = submissionInputSchema.parse(
          await readBoundedJson(request),
        );
        await service.consumeServiceBudget("submit");
        const result = await service.submitJob(input);
        return json(
          submissionResponseSchema.parse({ version: API_VERSION, ...result }),
          202,
        );
      }),
    metrics: (request: Request) =>
      handle(request, "metrics", async () => {
        const input = metricsInputSchema.parse(await readBoundedJson(request));
        await service.consumeServiceBudget("metrics", input.events.length);
        const result = await service.recordMetrics(input);
        return json(
          metricsResponseSchema.parse({ version: API_VERSION, ...result }),
          202,
        );
      }),
  };
}
