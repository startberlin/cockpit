import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import type { CompletedSubmission, TallyField } from "./tally";

export const TALLY_API_VERSION = "2025-02-01";

const questionSchema = z.object({
  id: z.string(),
  type: z.string(),
  isDeleted: z.boolean().optional(),
  fields: z
    .array(
      z.object({
        uuid: z.string(),
        type: z.string(),
        title: z.string().nullable().optional(),
      }),
    )
    .default([]),
});
type Question = z.infer<typeof questionSchema>;
const apiSubmissionSchema = z.object({
  id: z.string().min(1),
  formId: z.string().optional(),
  isCompleted: z.boolean(),
  submittedAt: z.iso.datetime({ offset: true }),
  responses: z.array(z.object({ questionId: z.string(), answer: z.unknown() })),
});
const submissionPageSchema = z.object({
  page: z.number().int().positive(),
  hasMore: z.boolean(),
  questions: z.array(questionSchema),
  submissions: z.array(apiSubmissionSchema),
});

export function hiddenFieldKeys(
  questions: Question[],
): Map<string, string | null> {
  const keys = new Map<string, string | null>();
  for (const question of questions) {
    if (question.isDeleted) continue;
    for (const field of question.fields) {
      if (field.type === "HIDDEN_FIELD")
        keys.set(`question_${question.id}_${field.uuid}`, field.title ?? null);
    }
  }
  return keys;
}

function apiFields(
  submission: z.infer<typeof apiSubmissionSchema>,
  questions: Question[],
): TallyField[] {
  const fields: TallyField[] = [];
  for (const question of questions) {
    const hiddenFields = question.fields.filter(
      (field) => field.type === "HIDDEN_FIELD",
    );
    if (hiddenFields.length === 0) continue;
    const responses = submission.responses.filter(
      (response) => response.questionId === question.id,
    );
    if (responses.length !== 1) continue;
    let answer = responses[0].answer;
    // Tally returns structured answers as objects or JSON-encoded strings.
    if (typeof answer === "string" && answer.startsWith("{")) {
      try {
        answer = JSON.parse(answer);
      } catch {
        /* Keep the literal string. */
      }
    }
    for (const field of hiddenFields) {
      const value =
        answer && typeof answer === "object" && !Array.isArray(answer)
          ? ((answer as Record<string, unknown>)[field.uuid] ?? null)
          : hiddenFields.length === 1
            ? answer
            : undefined;
      fields.push({
        key: `question_${question.id}_${field.uuid}`,
        type: "HIDDEN_FIELDS",
        value,
      });
    }
  }
  return fields;
}

export function createTallyReader(
  apiKey: string,
  fetcher: typeof fetch = fetch,
) {
  if (!apiKey) throw new Error("TALLY_API_KEY must be configured");
  async function get(url: string) {
    const response = await fetcher(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "tally-version": TALLY_API_VERSION,
      },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!response.ok)
      throw new Error(`Tally API request failed (${response.status})`);
    return response.json() as Promise<unknown>;
  }

  async function questions(formId: string) {
    const result = await get(
      `https://api.tally.so/forms/${encodeURIComponent(formId)}/questions`,
    );
    return z
      .array(questionSchema)
      .parse(
        Array.isArray(result)
          ? result
          : z.object({ questions: z.array(questionSchema) }).parse(result)
              .questions,
      );
  }

  async function connectWebhook(
    formId: string,
    cockpitUrl: string,
    signingSecret: string,
    pause = () => delay(650),
  ) {
    const endpoint = new URL("/api/tally/referrals", cockpitUrl);
    if (
      endpoint.protocol !== "https:" ||
      ![
        "cockpit.start-berlin.com",
        "staging.cockpit.start-berlin.com",
      ].includes(endpoint.hostname) ||
      !signingSecret
    )
      throw new Error(
        "Use a deployed START Cockpit HTTPS endpoint and signing secret",
      );
    const webhookSchema = z.object({
      id: z.string().min(1),
      formId: z.string(),
      url: z.string(),
      httpHeaders: z
        .array(z.object({ name: z.string(), value: z.string() }))
        .nullish(),
    });
    const matches: z.infer<typeof webhookSchema>[] = [];
    for (let page = 1; page <= 10_000; page++) {
      const result = z
        .object({
          page: z.number().int(),
          hasMore: z.boolean(),
          webhooks: z.array(webhookSchema),
        })
        .parse(
          await get(`https://api.tally.so/webhooks?page=${page}&limit=100`),
        );
      if (
        result.page !== page ||
        (result.hasMore && result.webhooks.length === 0)
      )
        throw new Error("Invalid webhook pagination");
      matches.push(
        ...result.webhooks.filter(
          (webhook) =>
            webhook.formId === formId && webhook.url === endpoint.toString(),
        ),
      );
      if (!result.hasMore) break;
      if (page === 10_000) throw new Error("Webhook pagination limit exceeded");
      await pause();
    }
    if (matches.length > 1)
      throw new Error(
        "Multiple referral webhooks exist for this form and endpoint",
      );
    const existing = matches[0];
    const response = await fetcher(
      `https://api.tally.so/webhooks${existing ? `/${encodeURIComponent(existing.id)}` : ""}`,
      {
        method: existing ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "tally-version": TALLY_API_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          formId,
          url: endpoint.toString(),
          eventTypes: ["FORM_RESPONSE"],
          signingSecret,
          httpHeaders: existing?.httpHeaders ?? [],
          ...(existing ? { isEnabled: true } : {}),
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!response.ok)
      throw new Error(
        `Tally webhook configuration failed (${response.status})`,
      );
    const result = z
      .object({ id: z.string().min(1) })
      .parse(await response.json());
    return { id: result.id, created: !existing };
  }

  async function reconcile(
    formId: string,
    ingest: (submission: CompletedSubmission) => Promise<{ inserted: boolean }>,
    pause = () => delay(650),
  ) {
    let inserted = 0;
    let duplicates = 0;
    let skipped = 0;
    for (let page = 1; page <= 10_000; page++) {
      const url = new URL(
        `https://api.tally.so/forms/${encodeURIComponent(formId)}/submissions`,
      );
      url.searchParams.set("filter", "completed");
      url.searchParams.set("limit", "500");
      url.searchParams.set("page", String(page));
      const result = submissionPageSchema.parse(await get(url.toString()));
      if (
        result.page !== page ||
        (result.hasMore && result.submissions.length === 0)
      )
        throw new Error("Invalid Tally pagination");
      for (const submission of result.submissions) {
        if (
          !submission.isCompleted ||
          (submission.formId && submission.formId !== formId)
        ) {
          skipped++;
          continue;
        }
        const saved = await ingest({
          formId,
          submissionId: submission.id,
          submittedAt: new Date(submission.submittedAt),
          fields: apiFields(submission, result.questions),
        });
        if (saved.inserted) inserted++;
        else duplicates++;
      }
      if (!result.hasMore)
        return { inserted, duplicates, skipped, pages: page };
      await pause();
    }
    throw new Error("Tally pagination limit exceeded");
  }

  return { questions, reconcile, connectWebhook };
}
