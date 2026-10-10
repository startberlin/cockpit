import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { it } from "node:test";

it("guards presence requests and binds them to the authenticated editor without exposing session identifiers", () => {
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
      const require = createRequire(import.meta.url);
      const Module = require("node:module");
      const originalLoad = Module._load;
      const sessionId = "00000000-0000-4000-8000-000000000001";
      const calls = [];
      let currentUser = { id: "current-user" };
      let permitted = true;
      let failure = null;
      class PresenceRequestError extends Error {
        constructor(message, status) { super(message); this.status = status; }
      }
      const snapshot = { editors: [{ userId: "other-user", name: "Other Editor", isChanging: true, sessionCount: 2 }], checkedAt: "2026-09-29T12:00:00.000Z" };
      Module._load = function (request, parent, ...rest) {
        if (request === "@/db/user") return { getCurrentUser: async () => currentUser };
        if (request === "@/env") return { env: { NEXT_PUBLIC_COCKPIT_URL: "https://cockpit.example.com" } };
        if (request === "@/lib/permissions/server") return { can: async () => permitted };
        if (request === "@/internal-apps/newsletter/lib/presence-server") return {
          PresenceRequestError,
          heartbeatIssuePresence: async (input) => { calls.push({ method: "POST", ...input }); if (failure) throw failure; return snapshot; },
          releaseIssuePresence: async (input) => { calls.push({ method: "DELETE", ...input }); if (failure) throw failure; },
        };
        return originalLoad.call(this, request, parent, ...rest);
      };
      globalThis.fetch = async () => { throw new Error("Unexpected network request"); };
      const api = require("./src/app/api/newsletter/issues/[id]/presence/route.ts");
      const context = { params: Promise.resolve({ id: "issue" }) };
      async function invoke(body, method = "POST", origin = "http://localhost:3000", routeContext = context) {
        const request = new Request("http://localhost:3000/api/newsletter/issues/issue/presence", { method, headers: { "content-type": "application/json", origin }, body: typeof body === "string" ? body : JSON.stringify(body) });
        const response = await api[method](request, routeContext);
        assert.match(response.headers.get("cache-control"), /private/);
        assert.match(response.headers.get("cache-control"), /no-store/);
        return response;
      }
      const heartbeat = { editorSessionId: sessionId, isChanging: true };
      currentUser = null;
      assert.equal((await invoke(heartbeat)).status, 401);
      currentUser = { id: "current-user" };
      permitted = false;
      assert.equal((await invoke(heartbeat)).status, 403);
      permitted = true;
      assert.equal((await invoke(heartbeat, "POST", "https://foreign.example.com")).status, 403);
      for (const invalid of [{ editorSessionId: "invalid", isChanging: true }, { editorSessionId: sessionId, isChanging: "true" }, { ...heartbeat, userId: "forged-user" }, { ...heartbeat, checkedAt: "2099-01-01T00:00:00Z" }, "malformed JSON"]) {
        assert.equal((await invoke(invalid)).status, 400);
      }
      assert.equal((await invoke(heartbeat, "POST", "http://localhost:3000", { params: Promise.resolve({ id: "x".repeat(129) }) })).status, 400);
      assert.equal(calls.length, 0);

      const response = await invoke(heartbeat);
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.deepEqual(body, snapshot);
      assert.equal(JSON.stringify(body).includes(sessionId), false);
      assert.equal(JSON.stringify(body).includes("editorSessionId"), false);
      assert.deepEqual(calls[0], { method: "POST", issueId: "issue", editorSessionId: sessionId, userId: "current-user", isChanging: true });
      assert.equal((await invoke(heartbeat, "POST", "https://cockpit.example.com")).status, 200);
      const release = await invoke({ editorSessionId: sessionId }, "DELETE");
      assert.equal(release.status, 204);
      assert.equal(await release.text(), "");
      assert.deepEqual(calls.at(-1), { method: "DELETE", issueId: "issue", editorSessionId: sessionId, userId: "current-user" });
      assert.equal((await invoke({ editorSessionId: sessionId, userId: "forged-user" }, "DELETE")).status, 400);

      for (const status of [404, 409]) {
        failure = new PresenceRequestError("Known presence failure", status);
        const failed = await invoke(heartbeat);
        assert.equal(failed.status, status);
        assert.deepEqual(await failed.json(), { error: "Known presence failure" });
      }
      failure = new Error("Private database details");
      const failed = await invoke(heartbeat);
      assert.equal(failed.status, 500);
      assert.equal(JSON.stringify(await failed.json()).includes("Private database details"), false);
    `,
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
