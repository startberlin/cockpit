import assert from "node:assert/strict";
import { it } from "node:test";
import {
  createMaintenanceBypass,
  verifyMaintenanceBypass,
} from "./maintenance";
import { safeRedirectPath } from "./safe-redirect";

it("limits the maintenance grant to the current session and thirty minutes", async () => {
  const now = Date.UTC(2026, 10, 18, 12);
  const key = "local-test-signing-key";
  const { expires, value } = await createMaintenanceBypass(
    "session-one",
    key,
    now,
  );
  assert.equal(expires.getTime(), now + 30 * 60 * 1000);
  assert.ok(!value.includes(key));
  assert.equal(
    await verifyMaintenanceBypass(value, "session-one", key, now),
    true,
  );
  assert.equal(
    await verifyMaintenanceBypass(value, "session-two", key, now),
    false,
  );
  assert.equal(
    await verifyMaintenanceBypass(value, "session-one", key, expires.getTime()),
    false,
  );
  assert.equal(
    await verifyMaintenanceBypass(value, "session-one", "rotated-key", now),
    false,
  );
});

it("keeps Cockpit paths with search parameters and fragments", () => {
  assert.equal(
    safeRedirectPath("/jobboard/../people?q=Jane#members"),
    "/people?q=Jane#members",
  );
  assert.equal(safeRedirectPath(undefined), "/");
  assert.equal(safeRedirectPath("https://example.org/"), "/");
  assert.equal(safeRedirectPath("//example.org/"), "/");
  assert.equal(safeRedirectPath("/people\\profile"), "/");
  assert.equal(safeRedirectPath("/people\n"), "/");
  assert.equal(safeRedirectPath("/people/..//"), "/");
});
