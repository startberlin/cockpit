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
      const mockDb = {
        select: () => ({ from: () => ({ where: async () => [{ total: 2 }] }) }),
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
        if (request === "@/lib/action-client") return { actionClient: { inputSchema: (schema) => ({ action: (handler) => (input) => handler({ parsedInput: schema.parse(input) }) }) } };
        if (request === "next/cache") return { revalidatePath: () => {} };
        if (parent.filename.endsWith("/actions/send.ts")) {
          if (request === "../lib/access") return { assertNewsletterAccess: async () => { if (!allowed) throw new Error("Forbidden"); } };
          if (request === "../lib/block-summary") return { isBlockEmpty: () => false };
          if (request === "../lib/render") return { renderIssue: async () => ({ html: "<p>Body</p>", text: "Body" }), hasUnsubscribeLink: () => true };
          if (request === "../lib/resend") return {
            isResendConfigured: () => true,
            sendMode: () => "live",
            createAndSendBroadcast: async (input, persist) => {
              assert.equal(input.name, "October");
              assert.equal(input.text, "Body");
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
