import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { it } from "node:test";

it("rejects competing draft revisions and advances successful saves monotonically", () => {
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
      const revision = "2026-09-29T12:00:00.000Z";
      Date.now = () => Date.parse(revision);
      const state = { id: "issue", status: "draft", subject: "Original", updatedAt: new Date(revision) };
      let writes = 0;
      let allowed = true;
      Module._load = function (request, parent, ...rest) {
        if (request === "@/db") return { __esModule: true, default: {
          update: () => ({ set: (values) => ({ where: (condition) => ({ returning: async () => {
            const query = dialect.sqlToQuery(condition);
            assert.match(query.sql, /date_trunc\\('milliseconds', "newsletter_issue"\\."updated_at"\\)/);
            const expected = query.params.at(-1);
            if (state.status !== "draft" || state.updatedAt.toISOString() !== expected) return [];
            writes++;
            Object.assign(state, values);
            return [{ updatedAt: state.updatedAt }];
          } }) }) }),
        } };
        if (request === "@/lib/action-client") return { actionClient: { inputSchema: (schema) => ({ action: (handler) => (input) => handler({ parsedInput: schema.parse(input) }) }) } };
        if (request === "next/cache") return { revalidatePath: () => { throw new Error("Autosave must not revalidate the editor"); } };
        if (request === "../lib/access" && parent.filename.endsWith("/actions/issues.ts")) return { assertNewsletterAccess: async () => { if (!allowed) throw new Error("Forbidden"); } };
        if (request === "../lib/render" && parent.filename.endsWith("/actions/issues.ts")) return {};
        return originalLoad.call(this, request, parent, ...rest);
      };
      globalThis.fetch = async () => { throw new Error("Unexpected network request"); };
      const api = require("./src/internal-apps/newsletter/actions/issues.ts");
      const input = { id: "issue", expectedUpdatedAt: revision, name: "October", subject: "First tab", previewText: "", blocks: [] };
      const first = await api.updateIssueAction(input);
      assert.equal(first.conflict, false);
      assert.equal(first.savedAt, "2026-09-29T12:00:00.001Z");
      const stale = await api.updateIssueAction({ ...input, subject: "Stale second tab" });
      assert.equal(stale.conflict, true);
      assert.match(stale.message, /local edits have been kept/);
      assert.equal(state.subject, "First tab");
      const next = await api.updateIssueAction({ ...input, expectedUpdatedAt: first.savedAt, subject: "Fresh revision" });
      assert.equal(next.savedAt, "2026-09-29T12:00:00.002Z");
      state.status = "scheduled";
      assert.equal((await api.updateIssueAction({ ...input, expectedUpdatedAt: next.savedAt })).conflict, true);
      assert.equal(writes, 2);
      allowed = false;
      await assert.rejects(api.updateIssueAction(input), /Forbidden/);
      assert.equal(writes, 2);
    `,
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
