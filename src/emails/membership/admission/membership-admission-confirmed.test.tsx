import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { render } from "react-email";

process.env.DATABASE_URL ??= "postgres://user:password@localhost:5432/test";
process.env.BETTER_AUTH_SECRET ??= "test-secret";
process.env.GOOGLE_CLIENT_ID ??= "test-client-id";
process.env.GOOGLE_CLIENT_SECRET ??= "test-client-secret";
process.env.AWS_REGION ??= "eu-central-1";
process.env.AWS_ACCESS_KEY_ID ??= "test-key-id";
process.env.AWS_SECRET_ACCESS_KEY ??= "test-secret-key";
process.env.AWS_SES_SNS_TOPIC_ARN ??=
  "arn:aws:sns:eu-central-1:123456789012:test-topic";
process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64 ??= "test-credentials";
process.env.NEXT_PUBLIC_COCKPIT_URL ??= "https://cockpit.example.com";
process.env.GOOGLE_DRIVE_LEGAL_DOCUMENTS_FOLDER_ID ??= "test-folder-id";

describe("MembershipAdmissionConfirmedEmail", () => {
  it("renders the active membership confirmation", async () => {
    const { default: MembershipAdmissionConfirmedEmail } = await import(
      "./membership-admission-confirmed"
    );
    const html = await render(
      <MembershipAdmissionConfirmedEmail firstName="Ada" />,
    );

    assert.match(html, /Your membership is active/);
    assert.doesNotMatch(html, /Set up membership payment/);
    assert.doesNotMatch(html, /40 EUR/);
  });

  it("does not include individual board vote details", async () => {
    const { default: MembershipAdmissionConfirmedEmail } = await import(
      "./membership-admission-confirmed"
    );
    const html = await render(
      <MembershipAdmissionConfirmedEmail firstName="Ada" />,
    );

    assert.doesNotMatch(html, /voted yes|voted no/i);
    assert.doesNotMatch(html, /cast.*vote/i);
  });

  it("addresses the member by first name", async () => {
    const { default: MembershipAdmissionConfirmedEmail } = await import(
      "./membership-admission-confirmed"
    );
    const html = await render(
      <MembershipAdmissionConfirmedEmail firstName="Farrukh" />,
    );

    assert.match(html, /Farrukh/);
  });
});
