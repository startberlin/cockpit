import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { Socket } from "node:net";
import { it } from "node:test";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { createElement } from "react";

it("uses the selected SES delivery policy", async (t) => {
  const env = {
    AWS_REGION: "eu-central-1",
    AWS_ACCESS_KEY_ID: "test-access-key",
    AWS_SECRET_ACCESS_KEY: "test-secret",
    DISABLE_EMAIL: false,
  };
  const load = createRequire(import.meta.url);
  const modules = load("node:module") as {
    _load(request: string, parent: NodeModule, isMain: boolean): unknown;
  };
  const originalLoad = modules._load;
  const stubs: Record<string, unknown> = {
    "server-only": {},
    "@/env": { env },
    "@/db": {},
    "@/lib/audit-log": {},
    "next/server": { after: () => {} },
  };
  const blockNetwork = () => assert.fail("Unexpected network request");
  t.mock.method(globalThis, "fetch", blockNetwork);
  t.mock.method(Socket.prototype, "connect", blockNetwork);
  const stub = t.mock.method(
    modules,
    "_load",
    (request: string, parent: NodeModule, isMain: boolean) => {
      if (
        parent.filename.endsWith("/lib/email.ts") &&
        Object.hasOwn(stubs, request)
      ) {
        return stubs[request];
      }
      return originalLoad.call(modules, request, parent, isMain);
    },
  );
  const api = load("./email.ts") as typeof import("./email");
  stub.mock.restore();

  const email = {
    from: "sender@example.invalid",
    to: "recipient@example.invalid",
    subject: "Transport test",
    react: createElement("p", null, "Test message"),
    userId: "test-recipient",
  };
  const attempts: number[] = [];
  const send = t.mock.method(
    SESv2Client.prototype,
    "send",
    async function (this: SESv2Client, command: SendEmailCommand) {
      assert.ok(command instanceof SendEmailCommand);
      assert.deepEqual(command.input.Destination?.ToAddresses, [email.to]);
      attempts.push(await this.config.maxAttempts());
      return { MessageId: "test-message-id" };
    },
  );

  await t.test(
    "acknowledged single-attempt delivery and legacy return value",
    async () => {
      assert.equal(await api.sendEmailOnce(email), "accepted");
      assert.deepEqual(attempts, [1]);
      assert.equal(await api.sendEmail(email), undefined);
      assert.equal(send.mock.callCount(), 2);
    },
  );

  await t.test("disabled delivery never calls SES", async () => {
    env.DISABLE_EMAIL = true;
    send.mock.resetCalls();
    assert.equal(await api.sendEmailOnce(email), "disabled");
    assert.equal(await api.sendEmail(email), undefined);
    assert.equal(send.mock.callCount(), 0);
  });
});
