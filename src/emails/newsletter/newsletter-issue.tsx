import { COCKPIT_URL } from "@/emails/components/cockpit-url";
import type { Block } from "@/internal-apps/newsletter/lib/blocks";
import {
  SAMPLE_EYEBROW,
  SAMPLE_PREVIEW_TEXT,
  SAMPLE_SUBJECT,
  sampleBlocks,
} from "@/internal-apps/newsletter/lib/sample-issue";
import { NewsletterBlock } from "./newsletter-blocks";
import { NewsletterShell } from "./newsletter-shell";

export interface NewsletterIssueEmailProps {
  subject: string;
  previewText?: string;
  eyebrow?: string;
  blocks: Block[];
}

/**
 * The whole issue as one email. This is the only renderer: the live preview in
 * the composer, the test send, and the broadcast that goes to Resend all go
 * through it, so what an author sees is what recipients get.
 */
export function NewsletterIssueEmail({
  subject,
  previewText,
  eyebrow,
  blocks,
}: NewsletterIssueEmailProps) {
  return (
    <NewsletterShell
      title={subject}
      preview={previewText || subject}
      eyebrow={eyebrow}
    >
      {blocks.map((block) => (
        <NewsletterBlock key={block.id} block={block} />
      ))}
    </NewsletterShell>
  );
}

NewsletterIssueEmail.PreviewProps = {
  subject: SAMPLE_SUBJECT,
  previewText: SAMPLE_PREVIEW_TEXT,
  eyebrow: SAMPLE_EYEBROW,
  blocks: sampleBlocks(COCKPIT_URL),
} as NewsletterIssueEmailProps;

export default NewsletterIssueEmail;
