import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { render } from "react-email";

// `src/env.ts` validates on import, and the template pulls in COCKPIT_URL, so
// the environment has to be stubbed before the dynamic import below.
process.env.DATABASE_URL ??= "postgres://user:password@localhost:5432/test";
process.env.BETTER_AUTH_SECRET ??= "test-secret";
process.env.AWS_REGION ??= "eu-central-1";
process.env.AWS_ACCESS_KEY_ID ??= "test";
process.env.AWS_SECRET_ACCESS_KEY ??= "test";
process.env.AWS_SES_SNS_TOPIC_ARN ??=
  "arn:aws:sns:eu-central-1:123456789012:test-topic";
process.env.NEXT_PUBLIC_COCKPIT_URL ??= "https://cockpit.example.com";
process.env.ENABLE_DEV_LOGIN ??= "true";
process.env.DISABLE_GOOGLE_WORKSPACE ??= "true";

const ASSET_BASE = "https://cockpit.example.com";

async function renderSampleIssue() {
  const { NewsletterIssueEmail } = await import("./newsletter-issue");
  const { sampleBlocks, SAMPLE_SUBJECT, SAMPLE_PREVIEW_TEXT } = await import(
    "@/internal-apps/newsletter/lib/sample-issue"
  );

  return render(
    NewsletterIssueEmail({
      subject: SAMPLE_SUBJECT,
      previewText: SAMPLE_PREVIEW_TEXT,
      eyebrow: "Issue 01",
      blocks: sampleBlocks(ASSET_BASE),
    }),
  );
}

describe("newsletter issue email", () => {
  it("keeps Resend merge tags intact", async () => {
    const html = await renderSampleIssue();

    // React escapes `<`, `>` and `&` but not braces, so the tags survive as
    // written. If that ever changed, Resend would stop personalising and the
    // unsubscribe link would break — which is a legal problem, not a cosmetic
    // one, so it is asserted rather than assumed.
    assert.match(html, /\{\{\{RESEND_UNSUBSCRIBE_URL\}\}\}/);
    assert.match(html, /\{\{\{contact\.first_name\|there\}\}\}/);
    assert.doesNotMatch(html, /&#x7b;|&lbrace;|&amp;#123;/);
  });

  it("puts the unsubscribe tag in an href, not just in the text", async () => {
    // `lib/render.ts` is `server-only`, which the plain test runner refuses to
    // load, so the invariant is asserted against the markup directly. The send
    // path guards on the same string via `hasUnsubscribeLink`.
    const html = await renderSampleIssue();
    assert.match(html, /href="\{\{\{RESEND_UNSUBSCRIBE_URL\}\}\}"/);
  });

  it("renders every block type in the sample issue", async () => {
    const html = await renderSampleIssue();

    for (const marker of [
      "founders, in your inbox once a month", // hero
      "Berlin startup news", // linkList
      "Three startups we like", // startupSpotlight
      "What we learned at Founders Night #12", // eventRecap
      "Marlene Ruck", // interview
      "Tobias Lenz", // alumniStory
      "Hiring in the network", // jobHighlight
      "Come to the next Founders Night", // button
    ]) {
      assert.ok(
        html.includes(marker),
        `expected the rendered issue to contain "${marker}"`,
      );
    }
  });

  it("carries the START Berlin brand colours rather than Cockpit's", async () => {
    const html = await renderSampleIssue();
    assert.match(html, /#00002C/i); // masthead navy
    assert.match(html, /#05C3DE/i); // accent cyan
  });

  it("gives every image explicit dimensions", async () => {
    // Mail clients have no aspect-ratio support, so an image without width and
    // height reflows the layout while it loads. Asserted across every image
    // rather than one known size, so a new block cannot quietly skip it.
    const html = await renderSampleIssue();
    const images = html.match(/<img\b[^>]*>/g) ?? [];

    assert.ok(images.length >= 5, "sample issue should contain images");
    for (const tag of images) {
      assert.match(tag, /\swidth="\d+"/, `image without width: ${tag}`);
      assert.match(tag, /\sheight="\d+"/, `image without height: ${tag}`);
    }
  });

  it("scales the hero to the content width, not the container width", async () => {
    // 600px container minus the 40px gutters on each side.
    const html = await renderSampleIssue();
    assert.match(html, /<img[^>]+src="[^"]*og-image\.png"[^>]*>/);
    assert.match(html, /width="520"/);
  });

  it("includes the association's legal footer", async () => {
    const html = await renderSampleIssue();
    assert.match(html, /START Berlin e\.V\./);
    assert.match(html, /VR 32262 B/);
  });

  it("produces a plain text alternative", async () => {
    const { NewsletterIssueEmail } = await import("./newsletter-issue");
    const { sampleBlocks } = await import(
      "@/internal-apps/newsletter/lib/sample-issue"
    );

    const text = await render(
      NewsletterIssueEmail({
        subject: "s",
        blocks: sampleBlocks(ASSET_BASE),
      }),
      { plainText: true },
    );

    assert.ok(text.length > 500, "plain text alternative should not be empty");
    assert.ok(!text.includes("<table"), "plain text should carry no markup");
  });

  it("renders an empty issue without throwing", async () => {
    // A newly created issue has no blocks and no subject; the composer renders
    // a preview immediately, so this is the very first thing it does.
    const { NewsletterIssueEmail } = await import("./newsletter-issue");
    const html = await render(
      NewsletterIssueEmail({ subject: "", blocks: [] }),
    );
    assert.ok(html.includes("START Berlin e.V."));
  });
});
