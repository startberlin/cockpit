import assert from "node:assert/strict";
import { it } from "node:test";
import { render } from "react-email";

process.env.NEXT_PUBLIC_COCKPIT_URL = "https://cockpit.example.test";

it("renders one personal inbox link and the employer's labels in both formats", async () => {
  const { JobboardSubmissionReceivedEmail, JOBBOARD_SUBMISSION_EMAIL_SUBJECT } =
    await import("./submission-received");
  const submissionId = "jbs_c8yARUdFTqKX9mcC";
  const url = `https://cockpit.example.test/notifications/jobboard/${submissionId}`;
  const message = (
    <JobboardSubmissionReceivedEmail
      submissionId={submissionId}
      companyName={"Müller & Söhne <Labs>\r\nBcc: example@example.test"}
      jobTitle={'Product Engineer <a href="https://example.invalid">Apply</a>'}
    />
  );
  const [html, plain] = await Promise.all([
    render(message),
    render(message, { plainText: true }),
  ]);
  assert.equal(
    JOBBOARD_SUBMISSION_EMAIL_SUBJECT,
    "New START Jobboard submission",
  );
  assert.deepEqual(
    Array.from(
      html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gi),
      (match) => match[1],
    ),
    [url],
  );
  assert.match(html, /Müller &amp; Söhne &lt;Labs&gt;/);
  assert.match(html, /Product Engineer &lt;a/);
  assert.match(html, /<h1\b/i);
  assert.doesNotMatch(html, /example\.invalid|example@example\.test/i);
  assert.match(plain, /Müller & Söhne <Labs>/);
  assert.match(plain, /Product Engineer/);
  assert.match(plain, /View submission in Cockpit/);
  assert.deepEqual(plain.match(/https?:\/\/[^\s]+/g), [url]);
  assert.doesNotMatch(plain, /^Bcc:|Stay connected/im);
});

it("rejects IDs containing a different path, query or fragment", async () => {
  const { JobboardSubmissionReceivedEmail } = await import(
    "./submission-received"
  );
  for (const submissionId of [
    "..",
    "jbs_../admin",
    "jbs_id?next=elsewhere",
    "jbs_id#anchor",
    "https://example.test",
  ]) {
    assert.throws(
      () =>
        JobboardSubmissionReceivedEmail({
          submissionId,
          companyName: "Employer",
          jobTitle: "Engineer",
        }),
      /Invalid Jobboard submission ID/,
    );
  }
});

it("keeps the standard Cockpit footer on existing mail templates", async () => {
  const { ParticipationChangeEmail } = await import(
    "../admin/participation-change"
  );
  const html = await render(
    <ParticipationChangeEmail
      recipientName="Example"
      paused
      effectiveDate="18 November 2026"
      cockpitUrl="https://cockpit.example.test/membership"
    />,
  );
  assert.match(html, /Stay connected/);
  assert.match(html, /Open START Cockpit/);
});
