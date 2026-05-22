import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { render } from "react-email";

const stripComments = (s: string) => s.replace(/<!--[\s\S]*?-->/g, "");

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

describe("Reminder banner across templates", () => {
  it("application-ready email shows reminder banner when isReminder=true", async () => {
    const { default: Email } = await import(
      "../membership/admission/membership-application-ready"
    );
    const html = stripComments(
      await render(
        <Email
          firstName="Ada"
          applicationUrl="https://cockpit.example.com/membership"
          isReminder
          daysOpen={6}
        />,
      ),
    );
    assert.match(html, /Reminder/);
    assert.match(html, /6 days/);
  });

  it("application-ready email omits banner by default", async () => {
    const { default: Email } = await import(
      "../membership/admission/membership-application-ready"
    );
    const html = stripComments(
      await render(
        <Email
          firstName="Ada"
          applicationUrl="https://cockpit.example.com/membership"
        />,
      ),
    );
    assert.doesNotMatch(html, /this action has been open/i);
  });

  it("mandate-cancelled email shows reminder banner when isReminder=true", async () => {
    const { default: Email } = await import(
      "../membership/payment/mandate-cancelled"
    );
    const html = stripComments(
      await render(
        <Email
          firstName="Ada"
          membershipUrl="https://cockpit.example.com/membership"
          isReminder
          daysOpen={3}
        />,
      ),
    );
    assert.match(html, /Reminder/);
    assert.match(html, /3 days/);
  });

  it("mandate-setup-needed renders without reminder banner", async () => {
    const { default: Email } = await import(
      "../membership/payment/mandate-setup-needed"
    );
    const html = stripComments(
      await render(
        <Email
          firstName="Ada"
          membershipUrl="https://cockpit.example.com/membership"
        />,
      ),
    );
    assert.match(html, /Set up your direct debit/);
    assert.doesNotMatch(html, /this action has been open/i);
  });

  it("cancellation-acknowledgement-needed email surfaces banner on reminder", async () => {
    const { default: Email } = await import(
      "../membership/cancellation/membership-cancellation-acknowledgement-needed"
    );
    const html = stripComments(
      await render(
        <Email
          firstName="Marie"
          subjectName="Sönke Peters"
          requestedAt="2026-05-21"
          profileUrl="https://cockpit.example.com/admin/people/directory/usr_x"
          isReminder
          daysOpen={9}
        />,
      ),
    );
    assert.match(html, /Reminder/);
    assert.match(html, /9 days/);
  });

  it("transition-approval-needed email surfaces banner on reminder", async () => {
    const { default: Email } = await import(
      "../membership/transition/membership-transition-approval-needed"
    );
    const html = stripComments(
      await render(
        <Email
          firstName="Marie"
          subjectName="Sönke Peters"
          transitionType="alumni_request"
          requestedAt="2026-05-21"
          profileUrl="https://cockpit.example.com/admin/people/directory/usr_x"
          isReminder
          daysOpen={4}
        />,
      ),
    );
    assert.match(html, /Reminder/);
    assert.match(html, /4 days/);
  });

  it("board-resolution-task-assigned email surfaces banner on reminder", async () => {
    const { default: Email } = await import(
      "../board-resolution/board-resolution-task-assigned"
    );
    const html = stripComments(
      await render(
        <Email
          firstName="Marie"
          subjectName="Sönke Peters"
          resolutionUrl="https://cockpit.example.com/people/resolutions/lm_x"
          isReminder
          daysOpen={5}
        />,
      ),
    );
    assert.match(html, /Reminder/);
    assert.match(html, /5 days/);
  });

  it("uses singular 'day' when daysOpen === 1", async () => {
    const { default: Email } = await import(
      "../membership/admission/membership-application-ready"
    );
    const html = stripComments(
      await render(
        <Email
          firstName="Ada"
          applicationUrl="https://cockpit.example.com/membership"
          isReminder
          daysOpen={1}
        />,
      ),
    );
    assert.match(html, /open for 1 day/);
  });
});
