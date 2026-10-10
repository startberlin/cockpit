import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { it } from "node:test";

it("registers only drafts, protects session ownership, and uses the database clock for presence", () => {
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
      import { drizzle } from "drizzle-orm/node-postgres";
      import pg from "pg";
      const require = createRequire(import.meta.url);
      const Module = require("node:module");
      const originalLoad = Module._load;
      const queries = [];
      let issueStatus = "draft";
      let registered = true;
      const clock = new Date("2026-09-29T12:00:00.000Z");
      const databaseClockText = "2026-09-29 14:00:00.000123+02";
      const client = {
        release() {},
        async query(query, params = []) {
          const text = typeof query === "string" ? query : query.text;
          queries.push({ text, params });
          if (/select "status"/i.test(text)) return { rows: issueStatus === null ? [] : [[issueStatus, databaseClockText]] };
          if (/insert into "newsletter_issue_editor"/i.test(text)) return { rows: registered ? [["current-user"]] : [] };
          if (/select "user"\\."id"/i.test(text)) return { rows: [["other-user", "Other Editor", 2, true], ["current-user", "Current Editor", 1, false]] };
          return { rows: [], rowCount: 0 };
        },
      };
      const pool = new pg.Pool({ connectionString: "postgresql://localhost/never_connected" });
      pool.connect = async () => client;
      pool.query = client.query.bind(client);
      const db = drizzle({ client: pool });
      Module._load = function (request, parent, ...rest) {
        if (request === "@/db") return { __esModule: true, default: db };
        return originalLoad.call(this, request, parent, ...rest);
      };
      globalThis.fetch = async () => { throw new Error("Unexpected network request"); };
      const api = require("./src/internal-apps/newsletter/lib/presence-server.ts");
      const input = { issueId: "issue", editorSessionId: "00000000-0000-4000-8000-000000000001", userId: "current-user", isChanging: true };
      const snapshot = await api.heartbeatIssuePresence(input);
      assert.equal(snapshot.checkedAt, clock.toISOString());
      assert.deepEqual(snapshot.editors.map((editor) => [editor.userId, editor.sessionCount]), [["other-user", 2], ["current-user", 1]]);
      assert.equal(JSON.stringify(snapshot).includes(input.editorSessionId), false);
      const draftRead = queries.find(({ text }) => /select "status"/i.test(text));
      assert.match(draftRead.text, /for share/i);
      const cleanup = queries.findIndex(({ text }) => /delete from "newsletter_issue_editor"/i.test(text));
      const upsert = queries.findIndex(({ text }) => /insert into "newsletter_issue_editor"/i.test(text));
      assert.ok(cleanup < upsert);
      assert.match(queries[cleanup].text, /limit 100/i);
      assert.match(queries[cleanup].text, /for update skip locked/i);
      assert.ok(queries[cleanup].params.includes(45000));
      assert.match(queries[upsert].text, /where "newsletter_issue_editor"\\."user_id" = \\$\\d+/i);
      assert.equal(queries[upsert].params.at(-1), input.userId);
      assert.match(queries[upsert].text, /now\\(\\)/);
      const others = queries.find(({ text }) => /select "user"\\."id"/i.test(text));
      assert.match(others.text, /"editor_session_id" <> \\$\\d+/i);
      assert.ok(others.params.includes(input.editorSessionId));
      assert.ok(others.params.includes(45000));
      assert.ok(others.params.includes(20000));
      assert.match(others.text, /group by "user"\\."id", "user"\\."name"/i);
      assert.match(queries.at(-1).text, /commit/i);

      queries.length = 0;
      await api.heartbeatIssuePresence({ ...input, isChanging: false });
      const idleUpsert = queries.find(({ text }) => /insert into "newsletter_issue_editor"/i.test(text));
      assert.ok(idleUpsert.params.includes(null));

      for (const [status, expectedCode] of [[null, 404], ["sent", 409]]) {
        issueStatus = status;
        queries.length = 0;
        await assert.rejects(api.heartbeatIssuePresence(input), (error) => error instanceof api.PresenceRequestError && error.status === expectedCode);
        assert.equal(queries.some(({ text }) => /insert into|delete from/i.test(text)), false);
        assert.match(queries.at(-1).text, /rollback/i);
      }
      issueStatus = "draft";
      registered = false;
      queries.length = 0;
      await assert.rejects(api.heartbeatIssuePresence(input), (error) => error instanceof api.PresenceRequestError && error.status === 409);
      assert.match(queries.at(-1).text, /rollback/i);
      assert.equal(queries.some(({ text }) => /select "user"\\."id"/i.test(text)), false);

      queries.length = 0;
      await api.releaseIssuePresence(input);
      assert.deepEqual(queries[0].params, [input.issueId, input.editorSessionId, input.userId]);
      assert.match(queries[0].text, /"issue_id" = \\$1.*"editor_session_id" = \\$2.*"user_id" = \\$3/i);
      await pool.end();
    `,
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
