import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  type CompletedSubmission,
  completedWebhookSubmission,
  tallyEventSchema,
} from "./tally";
import {
  createTallyReader,
  hiddenFieldKeys,
  TALLY_API_VERSION,
} from "./tally-api";

const questionId = "y0Xr16";
const refFieldId = "c709d80c-88d2-4975-95dc-f0099435ed01";
const campaignFieldId = "a6f886ea-97a1-4aaa-bb5b-50472a8c985f";
const refKey = `question_${questionId}_${refFieldId}`;
const campaignKey = `question_${questionId}_${campaignFieldId}`;
// Normalized metadata from the published form. API fields use the singular type;
// question and webhook types use HIDDEN_FIELDS.
const questions = [
  {
    id: questionId,
    type: "HIDDEN_FIELDS",
    fields: [
      { uuid: refFieldId, type: "HIDDEN_FIELD", title: "ref" },
      { uuid: campaignFieldId, type: "HIDDEN_FIELD", title: "campaign" },
    ],
  },
];
const completed = {
  id: "submission-1",
  formId: "Me9Xlp",
  isCompleted: true,
  submittedAt: "2026-10-09T12:00:00Z",
  responses: [
    {
      questionId,
      answer: {
        ref: "AbCdEfGhJkMnPqRs",
        campaign: "batch11-fall2026",
      },
    },
  ],
};
const page = (
  number: number,
  more: boolean,
  submissions: Array<{
    id: string;
    formId: string;
    isCompleted: boolean;
    submittedAt: string;
    responses: Array<{ questionId: string; answer: unknown }>;
  }> = [completed],
) => ({
  page: number,
  hasMore: more,
  questions,
  submissions,
});

describe("Tally completed-submission reconciliation", () => {
  it("creates a signed webhook without printing or forwarding the API key as its secret", async () => {
    const reader = createTallyReader("test-key", async (input, init) => {
      if (!init?.method)
        return Response.json({ page: 1, hasMore: false, webhooks: [] });
      assert.equal(String(input), "https://api.tally.so/webhooks");
      assert.equal(init.method, "POST");
      const body = JSON.parse(String(init.body));
      assert.equal(body.signingSecret, "derived-signing-secret");
      assert.equal(
        body.url,
        "https://cockpit.start-berlin.com/api/tally/referrals",
      );
      assert.deepEqual(body.eventTypes, ["FORM_RESPONSE"]);
      return Response.json({ id: "webhook-1" });
    });
    assert.deepEqual(
      await reader.connectWebhook(
        "Me9Xlp",
        "https://cockpit.start-berlin.com",
        "derived-signing-secret",
      ),
      { id: "webhook-1", created: true },
    );
  });
  it("finds an existing webhook across pages and refreshes its secret without creating a duplicate", async () => {
    let reads = 0;
    const reader = createTallyReader("test-key", async (input, init) => {
      if (!init?.method) {
        reads++;
        return Response.json({
          page: reads,
          hasMore: reads === 1,
          webhooks: [
            {
              id: reads === 1 ? "unrelated" : "owned",
              formId: "Me9Xlp",
              url:
                reads === 1
                  ? "https://example.test"
                  : "https://cockpit.start-berlin.com/api/tally/referrals",
              httpHeaders: [{ name: "X-Test", value: "keep" }],
            },
          ],
        });
      }
      assert.equal(String(input), "https://api.tally.so/webhooks/owned");
      assert.equal(init.method, "PATCH");
      const body = JSON.parse(String(init.body));
      assert.equal(body.isEnabled, true);
      assert.deepEqual(body.httpHeaders, [{ name: "X-Test", value: "keep" }]);
      return Response.json({ id: "owned" });
    });
    assert.deepEqual(
      await reader.connectWebhook(
        "Me9Xlp",
        "https://cockpit.start-berlin.com",
        "derived",
        async () => {},
      ),
      { id: "owned", created: false },
    );
    assert.equal(reads, 2);
  });
  it("refuses local or unrelated callback hosts and ambiguous existing webhooks", async () => {
    const item = {
      id: "owned",
      formId: "Me9Xlp",
      url: "https://cockpit.start-berlin.com/api/tally/referrals",
    };
    const reader = createTallyReader("test-key", async () =>
      Response.json({
        page: 1,
        hasMore: false,
        webhooks: [item, { ...item, id: "duplicate" }],
      }),
    );
    await assert.rejects(
      reader.connectWebhook("Me9Xlp", "http://localhost:3000", "derived"),
    );
    await assert.rejects(
      reader.connectWebhook("Me9Xlp", "https://example.test", "derived"),
    );
    await assert.rejects(
      reader.connectWebhook(
        "Me9Xlp",
        "https://cockpit.start-berlin.com",
        "derived",
      ),
      /Multiple/,
    );
  });
  it("resolves actual hidden UUID keys without using question order", () => {
    assert.deepEqual(
      hiddenFieldKeys(questions),
      new Map([
        [refKey, "ref"],
        [campaignKey, "campaign"],
      ]),
    );
  });
  it("requests every page with completed filtering and a pinned API version", async () => {
    const seen: CompletedSubmission[] = [];
    const visited: string[] = [];
    const reader = createTallyReader("test-key", async (input, init) => {
      const url = new URL(String(input));
      visited.push(url.searchParams.get("page") ?? "");
      assert.equal(url.searchParams.get("filter"), "completed");
      assert.equal(
        new Headers(init?.headers).get("tally-version"),
        TALLY_API_VERSION,
      );
      assert.equal(
        new Headers(init?.headers).get("authorization"),
        "Bearer test-key",
      );
      return Response.json(
        page(Number(url.searchParams.get("page")), visited.length === 1),
      );
    });
    const result = await reader.reconcile(
      "Me9Xlp",
      async (submission) => {
        seen.push(submission);
        return { inserted: seen.length === 1 };
      },
      async () => {},
    );
    assert.deepEqual(visited, ["1", "2"]);
    assert.deepEqual(result, {
      inserted: 1,
      duplicates: 1,
      skipped: 0,
      pages: 2,
    });
    assert.deepEqual(seen[0].fields, [
      {
        key: refKey,
        type: "HIDDEN_FIELDS",
        value: "AbCdEfGhJkMnPqRs",
      },
      {
        key: campaignKey,
        type: "HIDDEN_FIELDS",
        value: "batch11-fall2026",
      },
    ]);
  });
  it("skips partial submissions and another form even if the API returns them", async () => {
    const reader = createTallyReader("test-key", async () =>
      Response.json(
        page(1, false, [
          { ...completed, isCompleted: false },
          { ...completed, formId: "another" },
        ]),
      ),
    );
    assert.deepEqual(
      await reader.reconcile("Me9Xlp", async () =>
        assert.fail("Unexpected ingestion"),
      ),
      { inserted: 0, duplicates: 0, skipped: 2, pages: 1 },
    );
  });
  it("handles JSON-encoded hidden answers and loads setup field metadata", async () => {
    const reader = createTallyReader("test-key", async (input) =>
      Response.json(
        String(input).endsWith("/questions")
          ? {
              hasResponses: true,
              questions: questions.map((question) => ({
                ...question,
                fields: question.fields.map((field) => ({
                  ...field,
                  questionType: "HIDDEN_FIELDS",
                })),
              })),
            }
          : page(1, false, [
              {
                ...completed,
                responses: [
                  {
                    questionId,
                    answer: JSON.stringify(completed.responses[0].answer),
                  },
                ],
              },
            ]),
      ),
    );
    assert.deepEqual(await reader.questions("Me9Xlp"), questions);
    await reader.reconcile("Me9Xlp", async (submission) => {
      assert.deepEqual(submission.fields, [
        { key: refKey, type: "HIDDEN_FIELDS", value: "AbCdEfGhJkMnPqRs" },
        {
          key: campaignKey,
          type: "HIDDEN_FIELDS",
          value: "batch11-fall2026",
        },
      ]);
      return { inserted: true };
    });
  });
  it("normalizes both API hidden fields to the same fields as a completed webhook", async () => {
    const webhook = completedWebhookSubmission(
      tallyEventSchema.parse({
        eventId: "event-1",
        eventType: "FORM_RESPONSE",
        data: {
          formId: completed.formId,
          submissionId: completed.id,
          createdAt: completed.submittedAt,
          fields: [
            {
              key: refKey,
              type: "HIDDEN_FIELDS",
              value: completed.responses[0].answer.ref,
            },
            {
              key: campaignKey,
              type: "HIDDEN_FIELDS",
              value: completed.responses[0].answer.campaign,
            },
          ],
        },
      }),
    );
    assert.ok(webhook);
    const reader = createTallyReader("test-key", async () =>
      Response.json(page(1, false)),
    );
    await reader.reconcile("Me9Xlp", async (submission) => {
      assert.deepEqual(submission, webhook);
      return { inserted: true };
    });
  });
  it("maps the captured provider answer titles to their distinct webhook UUID keys", async () => {
    const reader = createTallyReader("test-key", async () =>
      Response.json({
        page: 1,
        hasMore: false,
        questions: [
          {
            id: "OjQxoY",
            type: "HIDDEN_FIELDS",
            isDeleted: false,
            fields: [
              {
                uuid: "79dc3d53-bd44-47f7-bc9f-f87de5ad7199",
                type: "HIDDEN_FIELD",
                questionType: "HIDDEN_FIELDS",
                title: "ref",
              },
              {
                uuid: "04bd369d-2fa9-4290-a530-25794fd8cc18",
                type: "HIDDEN_FIELD",
                questionType: "HIDDEN_FIELDS",
                title: "campaign",
              },
            ],
          },
        ],
        submissions: [
          {
            id: "rDR5YLo",
            formId: "kdD9ve",
            isCompleted: true,
            submittedAt: "2026-10-09T16:19:11.000Z",
            responses: [
              {
                questionId: "OjQxoY",
                answer: {
                  ref: "vULwxD9WzYksus7p",
                  campaign: "qa-referrals-20261009",
                },
              },
            ],
          },
        ],
      }),
    );
    let ingested = 0;
    await reader.reconcile("kdD9ve", async (submission) => {
      ingested++;
      assert.deepEqual(submission.fields, [
        {
          key: "question_OjQxoY_79dc3d53-bd44-47f7-bc9f-f87de5ad7199",
          type: "HIDDEN_FIELDS",
          value: "vULwxD9WzYksus7p",
        },
        {
          key: "question_OjQxoY_04bd369d-2fa9-4290-a530-25794fd8cc18",
          type: "HIDDEN_FIELDS",
          value: "qa-referrals-20261009",
        },
      ]);
      return { inserted: true };
    });
    assert.equal(ingested, 1);
  });
  it("fails clearly on authorization, invalid data or broken pagination", async () => {
    assert.throws(() => createTallyReader(""));
    for (const response of [
      new Response("Denied", { status: 403 }),
      Response.json({ invalid: true }),
      Response.json(page(2, false)),
      Response.json(page(1, true, [])),
    ]) {
      await assert.rejects(
        createTallyReader("test-key", async () => response).reconcile(
          "Me9Xlp",
          async () => ({ inserted: true }),
        ),
      );
    }
  });
});
