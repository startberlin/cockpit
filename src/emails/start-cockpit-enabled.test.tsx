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

type StartCockpitEnabledEmailProps = {
  firstName: string;
  statusContext?: "member" | "supporting_alumni" | "alumni";
};

async function renderEmail(props: StartCockpitEnabledEmailProps) {
  const { default: StartCockpitEnabledEmail } = await import(
    "./start-cockpit-enabled"
  );

  return await render(<StartCockpitEnabledEmail {...props} />);
}

describe("StartCockpitEnabledEmail", () => {
  it("renders supporting alumni context", async () => {
    const html = await renderEmail({
      firstName: "Ada",
      statusContext: "supporting_alumni",
    });

    assert.match(html, /Supporting Alumni/);
  });

  it("renders alumni context", async () => {
    const html = await renderEmail({
      firstName: "Ada",
      statusContext: "alumni",
    });

    assert.match(html, /Alumni/);
  });

  it("works without explicit status context", async () => {
    const html = await renderEmail({ firstName: "Ada" });

    assert.match(html, /Your START Cockpit access is ready/);
  });

  it("explains that sign-in uses the START Berlin Google Account", async () => {
    const html = await renderEmail({
      firstName: "Ada",
      statusContext: "member",
    });

    assert.match(html, /START Berlin Google Account/);
    assert.match(html, /Email and password login is not available/);
  });
});
