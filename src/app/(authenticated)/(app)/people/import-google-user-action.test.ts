import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { render } from "@react-email/render";

process.env.DATABASE_URL ??= "postgres://user:password@localhost:5432/test";
process.env.BETTER_AUTH_SECRET ??= "test-secret";
process.env.GOOGLE_CLIENT_ID ??= "test-client-id";
process.env.GOOGLE_CLIENT_SECRET ??= "test-client-secret";
process.env.RESEND_API_KEY ??= "test-resend-key";
process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64 ??= "test-credentials";
process.env.SLACK_SIGNING_SECRET ??= "test-slack-secret";
process.env.NEXT_PUBLIC_COCKPIT_URL ??= "https://cockpit.example.com";

async function buildEmail(status: "member" | "supporting_alumni" | "alumni") {
  const { buildImportedUserNotificationEmail } = await import(
    "./import-google-user-email"
  );

  return buildImportedUserNotificationEmail({
    email: "ada@start-berlin.com",
    firstName: "Ada",
    status,
  });
}

describe("buildImportedUserNotificationEmail", () => {
  it("sends imported user notifications to the START email address", async () => {
    const email = await buildEmail("member");

    assert.equal(email.to, "ada@start-berlin.com");
    assert.equal(email.subject, "You can now use START Cockpit");
  });

  it("renders supporting alumni status context", async () => {
    const email = await buildEmail("supporting_alumni");
    const html = await render(email.react);

    assert.match(html, /Supporting Alumni/);
  });

  it("renders Google Account sign-in instructions", async () => {
    const email = await buildEmail("alumni");
    const html = await render(email.react);

    assert.match(html, /START Berlin Google Account/);
    assert.match(html, /Email and password login is not available/);
  });
});

describe("importedMembershipPaymentValues", () => {
  it("keeps paid-through imports eligible for GoCardless setup", async () => {
    const { importedMembershipPaymentValues } = await import("@/db/membership");
    const paidThroughAt = new Date("2026-09-30T23:59:59.999Z");

    const values = importedMembershipPaymentValues({
      userId: "usr_imported",
      paidThroughAt,
    });

    assert.equal(values.userId, "usr_imported");
    assert.equal(values.provider, "gocardless");
    assert.equal(values.status, "pending");
    assert.equal(values.paidThroughAt, paidThroughAt);
    assert.equal(values.activatedAt, null);
  });

  it("creates the same pending GoCardless setup state without coverage", async () => {
    const { importedMembershipPaymentValues } = await import("@/db/membership");

    const values = importedMembershipPaymentValues({
      userId: "usr_imported",
      paidThroughAt: null,
    });

    assert.equal(values.provider, "gocardless");
    assert.equal(values.status, "pending");
    assert.equal(values.paidThroughAt, null);
    assert.equal(values.activatedAt, null);
  });
});

describe("createImportedMembershipPayment", () => {
  it("requires billing for supporting alumni imports", async () => {
    const { requiresMembershipBilling } = await import("@/db/membership");

    assert.equal(requiresMembershipBilling("member"), true);
    assert.equal(requiresMembershipBilling("supporting_alumni"), true);
    assert.equal(requiresMembershipBilling("alumni"), false);
    assert.equal(requiresMembershipBilling("onboarding"), false);
  });
});
