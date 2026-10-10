import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { it } from "node:test";

it("preserves reports when tracking is unavailable and does not turn missing metrics into zero", () => {
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
      let metrics = new Map();
      const broadcasts = [{ id: "first", name: "First", status: "sent", sentAt: "2026-09-01T12:00:00Z" }, { id: "second", name: "Second", status: "sent", sentAt: "2026-08-01T12:00:00Z" }];
      Module._load = function (request, parent, ...rest) {
        if (request === "@/db") return { __esModule: true, default: { select: () => ({ from: () => ({ where: async () => [] }) }) } };
        if (request === "./resend" && parent.filename.endsWith("/lib/analytics.ts")) return {
          listBroadcasts: async () => broadcasts,
          getDomainTracking: async () => { throw new Error("Domain permission denied"); },
          getBroadcastMetrics: async () => metrics,
        };
        return originalLoad.call(this, request, parent, ...rest);
      };
      globalThis.fetch = async () => { throw new Error("Unexpected network request"); };
      const api = require("./src/internal-apps/newsletter/lib/analytics.ts");
      const missing = await api.getAnalyticsOverview();
      assert.equal(missing.reports.length, 2);
      assert.equal(missing.metricReportCount, 0);
      assert.deepEqual(missing.totals, {});
      assert.match(missing.error, /Domain tracking could not be checked/);
      metrics = new Map([["first", { delivered: 100, unique_clicked: 0 }]]);
      const partial = await api.getAnalyticsOverview();
      assert.equal(partial.metricReportCount, 1);
      assert.equal(partial.totals.delivered, 100);
      assert.equal(partial.totals.unique_clicked, 0);
      assert.equal(partial.totals.opened, undefined);
      assert.equal(api.rate(undefined, 100), null);
      assert.equal(api.rate(0, 100), 0);
      assert.equal(api.rate(5, 100), 5);
      assert.equal(api.rate(5, 0), null);
    `,
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
