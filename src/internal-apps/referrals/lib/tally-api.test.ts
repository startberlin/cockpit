import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CompletedSubmission } from "./tally";
import {
  createTallyReader,
  hiddenFieldKeys,
  TALLY_API_VERSION,
} from "./tally-api";

const questions = [
  {
    id: "hidden",
    type: "HIDDEN_FIELDS",
    fields: [
      { uuid: "ref-uuid", type: "HIDDEN_FIELDS", title: "ref" },
      { uuid: "campaign-uuid", type: "HIDDEN_FIELDS", title: "campaign" },
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
      questionId: "hidden",
      answer: {
        "ref-uuid": "AbCdEfGhJkMnPqRs",
        "campaign-uuid": "batch11-fall2026",
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
    assert.equal(
      hiddenFieldKeys(questions).get("question_hidden_ref-uuid"),
      "ref",
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
        key: "question_hidden_ref-uuid",
        type: "HIDDEN_FIELDS",
        value: "AbCdEfGhJkMnPqRs",
      },
      {
        key: "question_hidden_campaign-uuid",
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
          ? questions
          : page(1, false, [
              {
                ...completed,
                responses: [
                  {
                    questionId: "hidden",
                    answer: JSON.stringify(completed.responses[0].answer),
                  },
                ],
              },
            ]),
      ),
    );
    assert.deepEqual(await reader.questions("Me9Xlp"), questions);
    await reader.reconcile("Me9Xlp", async (submission) => {
      assert.equal(submission.fields[0].value, "AbCdEfGhJkMnPqRs");
      return { inserted: true };
    });
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
