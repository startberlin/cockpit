import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { it } from "node:test";

it("keeps accepted sends recoverable, rejects concurrent dispatch, and preserves cancellation", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--conditions=react-server",
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      `
      import assert from "node:assert/strict";
      import { createRequire } from "node:module";
      import { PgDialect } from "drizzle-orm/pg-core";
      const require = createRequire(import.meta.url);
      const Module = require("node:module");
      const originalLoad = Module._load;
      const dialect = new PgDialect();
      const initial = { id: "issue", name: "October", subject: "A subject", previewText: "Preview", blocks: [{ id: "block", kind: "rich-text", data: {} }], status: "draft", fromAddress: null, replyTo: null, segmentId: "segment", topicId: null, resendBroadcastId: null, lastError: null, updatedAt: new Date("2026-09-29T12:00:00.000Z") };
      const input = { id: "issue", expectedUpdatedAt: initial.updatedAt.toISOString() };
      let state = structuredClone(initial);
      let allowed = true;
      let recordFails = false;
      let cancelDuringSend = false;
      let sendFails = true;
      let updates = 0;
      let dispatched = 0;
      const contacts = [
        { id: "opted-out-globally", unsubscribed: true },
        { id: "subscriber", unsubscribed: false },
      ];
      let preference = "opt_out";
      let broadcastTopic = null;
      let segmentFails = false;
      const mockDb = {
        select: () => ({ from: () => ({ where: () => ({ limit: async () => [structuredClone(state)] }) }) }),
        update: () => ({ set: (values) => ({ where: (condition) => {
          const query = dialect.sqlToQuery(condition);
          const apply = () => {
            updates++;
            const columns = { id: "id", status: "status", resend_broadcast_id: "resendBroadcastId" };
            for (const match of query.sql.matchAll(/"newsletter_issue"\\."([a-z_]+)" = \\$(\\d+)/g)) {
              if (state[columns[match[1]]] !== query.params[Number(match[2]) - 1]) return [];
            }
            if (query.sql.includes("date_trunc") && state.updatedAt.toISOString() !== query.params.at(-1)) return [];
            if (query.sql.includes('"resend_broadcast_id" is null') && state.resendBroadcastId !== null) return [];
            if (recordFails && values.resendBroadcastId) throw new Error("Database unavailable");
            for (const [key, value] of Object.entries(values)) {
              if (key === "updatedAt" && !(value instanceof Date)) continue;
              if (value !== undefined) state[key] = value;
            }
            return [structuredClone(state)];
          };
          return { returning: async () => apply(), then: (resolve, reject) => Promise.resolve().then(apply).then(resolve, reject) };
        } }) }),
      };
      Module._load = function (request, parent, ...rest) {
        if (request === "@/db") return { __esModule: true, default: mockDb };
        if (request === "@/env") return { env: { RESEND_NEWSLETTER_SEGMENT_ID: "segment", NEXT_PUBLIC_COCKPIT_URL: "http://localhost:3000" } };
        if (request === "@/lib/action-client") {
          const { createSafeActionClient } = require("next-safe-action");
          const client = createSafeActionClient({
            throwValidationErrors: true,
            handleServerError(error) { throw error; },
          });
          return { actionClient: { inputSchema: (schema) => ({ action: (handler) => {
            const run = client.inputSchema(schema).action(handler);
            return async (input) => (await run(input)).data;
          } }) } };
        }
        if (request === "next/cache") return { revalidatePath: () => {} };
        if (parent.filename.endsWith("/actions/send.ts")) {
          if (request === "../lib/access") return { assertNewsletterAccess: async () => { if (!allowed) throw new Error("Forbidden"); } };
          if (request === "../lib/block-summary") return { isBlockEmpty: () => false };
          if (request === "../lib/render") return { renderIssue: async () => ({ html: "<p>Body</p>", text: "Body" }), hasUnsubscribeLink: () => true };
          if (request === "../lib/resend") return {
            isResendConfigured: () => true,
            sendMode: () => "live",
            listAllContacts: async ({ segmentId }) => {
              assert.equal(segmentId, "segment");
              if (segmentFails) throw new Error("Resend unavailable");
              return contacts;
            },
            listTopics: async () => [{ id: "updates" }],
            listContactTopicSubscriptions: async (contactId) => {
              assert.equal(contactId, "subscriber");
              return { updates: preference };
            },
            createAndSendBroadcast: async (input, persist) => {
              assert.equal(input.name, "October");
              assert.equal(input.text, "Body");
              broadcastTopic = input.topicId;
              await persist({ broadcastId: "remote-broadcast", mode: "live" });
              dispatched++;
              if (cancelDuringSend) state.status = "canceled";
              if (sendFails) throw new Error("Response lost after acceptance");
              return { broadcastId: "remote-broadcast", mode: "live" };
            },
          };
        }
        return originalLoad.call(this, request, parent, ...rest);
      };
      globalThis.fetch = async () => { throw new Error("Unexpected network request"); };
      const api = require("./src/internal-apps/newsletter/actions/send.ts");
      const first = api.scheduleIssueAction(input);
      await assert.rejects(api.scheduleIssueAction(input), (error) => error.validationErrors?._errors?.[0].includes("changed in another tab"));
      await assert.rejects(first, /Response lost/);
      assert.equal(dispatched, 1);
      assert.equal(state.status, "sending");
      assert.equal(state.resendBroadcastId, "remote-broadcast");
      assert.match(state.lastError, /Response lost/);

      state = structuredClone(initial);
      sendFails = false;
      cancelDuringSend = true;
      await api.scheduleIssueAction({ ...input, scheduledAt: "2099-01-01T12:00:00Z" });
      assert.equal(state.status, "canceled");

      state = structuredClone(initial);
      cancelDuringSend = false;
      recordFails = true;
      const sendsBeforeFailure = dispatched;
      await assert.rejects(api.scheduleIssueAction(input), /Database unavailable/);
      assert.equal(dispatched, sendsBeforeFailure);
      assert.equal(state.status, "failed");
      assert.equal(state.resendBroadcastId, null);

      state = structuredClone(initial);
      state.updatedAt = new Date(initial.updatedAt.getTime() + 1);
      const sendsBeforeStaleRevision = dispatched;
      await assert.rejects(api.scheduleIssueAction(input), (error) => error.validationErrors?._errors?.[0].includes("changed in another tab"));
      assert.equal(dispatched, sendsBeforeStaleRevision);
      assert.equal(state.status, "draft");

      state = structuredClone(initial);
      recordFails = false;
      const scoped = { ...input, topicId: "updates" };
      const preview = await api.preflightAction(scoped);
      assert.equal(preview.recipients, 1);
      assert.deepEqual(preview.problems, []);

      const invalidTopic = await api.preflightAction({ ...scoped, topicId: "removed" });
      assert.deepEqual(invalidTopic.problems.map(({ code }) => code), ["invalid-topic"]);

      const sendsBeforeAudienceCheck = dispatched;
      const optedOut = await api.scheduleIssueAction(scoped);
      assert.deepEqual(optedOut.problems.map(({ code }) => code), ["empty-topic"]);
      assert.equal(state.status, "draft");
      assert.equal(dispatched, sendsBeforeAudienceCheck);

      preference = undefined;
      const missingPreference = await api.scheduleIssueAction(scoped);
      assert.deepEqual(missingPreference.problems.map(({ code }) => code), ["topic-recipients-lookup-failed"]);
      assert.equal(state.status, "draft");
      assert.equal(dispatched, sendsBeforeAudienceCheck);

      preference = "opt_in";
      segmentFails = true;
      const missingSegment = await api.scheduleIssueAction(scoped);
      assert.deepEqual(missingSegment.problems.map(({ code }) => code), ["segment-lookup-failed"]);
      assert.equal(state.status, "draft");
      assert.equal(dispatched, sendsBeforeAudienceCheck);

      segmentFails = false;
      assert.equal((await api.scheduleIssueAction(scoped)).ok, true);
      assert.equal(broadcastTopic, "updates");
      assert.equal(dispatched, sendsBeforeAudienceCheck + 1);

      allowed = false;
      const updatesBeforeDenial = updates;
      await assert.rejects(api.scheduleIssueAction(input), /Forbidden/);
      assert.equal(updates, updatesBeforeDenial);
    `,
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
