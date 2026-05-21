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

type MembershipAdmissionConfirmedEmailProps = {
  firstName: string;
  includesPaymentCta: boolean;
  membershipUrl: string;
};

async function renderEmail(props: MembershipAdmissionConfirmedEmailProps) {
  const { default: MembershipAdmissionConfirmedEmail } = await import(
    "./membership-admission-confirmed"
  );
  return await render(<MembershipAdmissionConfirmedEmail {...props} />);
}

describe("MembershipAdmissionConfirmedEmail", () => {
  it("renders payment CTA when includesPaymentCta is true", async () => {
    const html = await renderEmail({
      firstName: "Ada",
      includesPaymentCta: true,
      membershipUrl: "https://cockpit.example.com/membership",
    });

    assert.match(html, /Set up membership payment/);
    assert.match(html, /40 EUR/);
  });

  it("does not render payment CTA when includesPaymentCta is false", async () => {
    const html = await renderEmail({
      firstName: "Ada",
      includesPaymentCta: false,
      membershipUrl: "https://cockpit.example.com/membership",
    });

    assert.doesNotMatch(html, /Set up membership payment/);
    assert.doesNotMatch(html, /40 EUR/);
    assert.match(html, /Your membership is active/);
  });

  it("does not include individual board vote details", async () => {
    const html = await renderEmail({
      firstName: "Ada",
      includesPaymentCta: false,
      membershipUrl: "https://cockpit.example.com/membership",
    });

    assert.doesNotMatch(html, /voted yes|voted no/i);
    assert.doesNotMatch(html, /cast.*vote/i);
  });

  it("addresses the member by first name", async () => {
    const html = await renderEmail({
      firstName: "Farrukh",
      includesPaymentCta: true,
      membershipUrl: "https://cockpit.example.com/membership",
    });

    assert.match(html, /Farrukh/);
  });
});
