import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { it } from "node:test";

const TEST_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_ENV: "test",
  NEWSLETTER_SEND_MODE: "sandbox",
  RESEND_API_KEY: "re_test_never_sent",
  DATABASE_URL: "postgresql://localhost/audit_unused",
  BETTER_AUTH_SECRET: "audit-unused-secret",
  GOOGLE_CLIENT_ID: "audit-unused-id",
  GOOGLE_CLIENT_SECRET: "audit-unused-secret",
  AWS_REGION: "eu-central-1",
  AWS_ACCESS_KEY_ID: "audit-unused",
  AWS_SECRET_ACCESS_KEY: "audit-unused",
  AWS_SES_SNS_TOPIC_ARN: "audit-unused",
  DISABLE_GOOGLE_WORKSPACE: "true",
  NEXT_PUBLIC_COCKPIT_URL: "http://localhost:3000",
};

it("keeps sandbox writes local and reads complete segment pages", () => {
  // The child uses React's server condition for server-only imports. Fetch is
  // a tripwire: this test cannot make an accidental request to a real account.
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
    import api from "./src/internal-apps/newsletter/lib/resend.ts";
    let requests = 0;
    globalThis.fetch = async () => { requests++; throw new Error("Unexpected network request"); };
    let persisted = false;
    const result = await api.createAndSendBroadcast({ name: "Audit", segmentId: "segment", from: "sender@example.com", subject: "Audit", html: "<p>Test</p>", text: "Test" }, async (result) => { assert.equal(result.mode, "sandbox"); persisted = true; });
    assert.equal(persisted, true);
    assert.equal(result.mode, "sandbox");
    assert.match(result.broadcastId, /^sandbox_/);
    await api.sendTestEmail({ from: "sender@example.com", to: ["recipient@example.com"], subject: "Test", html: "<p>Test</p>", text: "Test" });
    await api.importContactsCsv({ csv: "email\\nperson@example.com", filename: "audit.csv" });
    await api.addContactToSegment("contact", "segment");
    await api.cancelBroadcast(result.broadcastId);
    await assert.rejects(api.cancelBroadcast("live-broadcast"), /cannot be canceled from sandbox/);
    assert.equal(requests, 0);
    const paths = [];
    globalThis.fetch = async (url) => {
      const u = new URL(String(url)); paths.push(u.pathname);
      const after = u.searchParams.get("after");
      return Response.json({ object: "list", has_more: !after, data: [{ id: after ? "second" : "first", email: after ? "two@example.com" : "one@example.com", first_name: null, last_name: null, unsubscribed: false, created_at: "2026-01-01T00:00:00Z" }] });
    };
    const contacts = await api.listAllContacts({ segmentId: "segment" });
    assert.deepEqual(contacts.map(c => c.id), ["first", "second"]);
    assert.deepEqual(paths, ["/segments/segment/contacts", "/segments/segment/contacts"]);
    await assert.rejects(api.listAllContacts({ segmentId: "segment", maxPages: 1 }), /exceeds the sync page limit/);
    globalThis.fetch = async () => Response.json({ has_more: false });
    await assert.rejects(api.listAllContacts(), /incomplete pagination/);
    await assert.rejects(api.listSegments(), /incomplete pagination/);
    globalThis.fetch = async () => Response.json({ data: [{ id: "incomplete", email: "one@example.com" }], has_more: false });
    await assert.rejects(api.listAllContacts(), /incomplete or duplicate contact/);
    globalThis.fetch = async () => Response.json({ data: [{ id: "duplicate", email: "one@example.com", unsubscribed: false }], has_more: true });
    await assert.rejects(api.listAllContacts(), /incomplete or duplicate contact/);

  `,
    ],
    {
      encoding: "utf8",
      env: TEST_ENV,
    },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

it("retries provider rate-limit responses without relying on the message text", () => {
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
      import api from "./src/internal-apps/newsletter/lib/resend.ts";
      let attempts = 0;
      globalThis.fetch = async () => {
        attempts++;
        if (attempts === 1) return Response.json({ name: "rate_limit_exceeded", statusCode: 429, message: "Account is busy" }, { status: 429 });
        return Response.json({ data: [], has_more: false });
      };
      assert.deepEqual(await api.listAllContacts(), []);
      assert.equal(attempts, 2);
    `,
    ],
    { encoding: "utf8", env: TEST_ENV },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

it("persists broadcast identity before dispatch and does not send an unrecorded draft", () => {
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
      import api from "./src/internal-apps/newsletter/lib/resend.ts";
      const events = [];
      globalThis.fetch = async (url, options) => {
        const path = new URL(String(url)).pathname;
        events.push(path);
        if (path === "/broadcasts") {
          const body = JSON.parse(options.body);
          assert.equal(body.send, false);
          assert.equal(body.name, "October edition");
          assert.equal(body.text, "Plain text");
          assert.equal(body.scheduled_at, undefined);
        } else if (path.endsWith("/send")) {
          assert.equal(JSON.parse(options.body).scheduled_at, "2099-01-01T12:00:00Z");
        } else assert.equal(options.method, "DELETE");
        return Response.json({ id: "broadcast" });
      };
      const input = { name: "October edition", segmentId: "segment", from: "sender@example.com", subject: "Audit", html: "<p>Test</p>", text: "Plain text", scheduledAt: "2099-01-01T12:00:00Z" };
      await api.createAndSendBroadcast(input, async ({ broadcastId, mode }) => {
        assert.equal(broadcastId, "broadcast");
        assert.equal(mode, "live");
        events.push("persisted");
      });
      assert.deepEqual(events, ["/broadcasts", "persisted", "/broadcasts/broadcast/send"]);
      events.length = 0;
      await assert.rejects(api.createAndSendBroadcast(input, async () => { throw new Error("Database unavailable"); }), /Database unavailable/);
      assert.deepEqual(events, ["/broadcasts", "/broadcasts/broadcast"]);
      events.length = 0;
      globalThis.fetch = async (url) => {
        const path = new URL(String(url)).pathname;
        events.push(path);
        if (path.endsWith("/send")) throw new Error("Response lost after acceptance");
        return Response.json({ id: "uncertain-broadcast" });
      };
      let recorded = null;
      await assert.rejects(api.createAndSendBroadcast(input, async (result) => { recorded = result; }), /broadcasts.send failed/);
      assert.equal(recorded.broadcastId, "uncertain-broadcast");
      assert.deepEqual(events, ["/broadcasts", "/broadcasts/uncertain-broadcast/send"]);
    `,
    ],
    {
      encoding: "utf8",
      env: {
        ...TEST_ENV,
        NEWSLETTER_SEND_MODE: "live",
      },
    },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

it("reads older broadcasts and every clicked link, rejecting incomplete history", () => {
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
      import api from "./src/internal-apps/newsletter/lib/resend.ts";
      const queries = [];
      globalThis.fetch = async (url) => {
        const u = new URL(String(url));
        queries.push(u.searchParams.get("after"));
        const after = u.searchParams.get("after");
        const data = after ? [{ id: "old", name: "Older", status: "sent", sent_at: "2025-01-01T12:00:00Z" }] : Array.from({ length: 100 }, (_, index) => ({ id: "broadcast-" + index, name: "Newer", status: "sent", sent_at: "2026-01-01T12:00:00Z" }));
        return Response.json({ data, has_more: !after });
      };
      const broadcasts = await api.listBroadcasts();
      assert.equal(broadcasts.length, 101);
      assert.equal(broadcasts.at(-1).name, "Older");
      assert.deepEqual(queries, [null, "broadcast-99"]);
      globalThis.fetch = async (url) => {
        const after = new URL(String(url)).searchParams.get("after");
        return Response.json({ data: [{ id: after ? "second" : "first", url: "https://example.com/" + (after ? "second" : "first"), clicks: 1, unique_clicks: 1 }], has_more: !after });
      };
      assert.equal((await api.getClickedLinks("broadcast")).length, 2);
      globalThis.fetch = async () => Response.json({ data: [], has_more: true });
      await assert.rejects(api.listBroadcasts(), /incomplete pagination/);
      await assert.rejects(api.getClickedLinks("broadcast"), /incomplete pagination/);
    `,
    ],
    {
      encoding: "utf8",
      env: TEST_ENV,
    },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
