import "server-only";

import { render, toPlainText } from "react-email";
import { NewsletterIssueEmail } from "@/emails/newsletter/newsletter-issue";
import {
  FIRST_NAME_TAG,
  UNSUBSCRIBE_URL_TAG,
} from "@/emails/newsletter/newsletter-shell";
import type { Block } from "./blocks";

export interface RenderIssueInput {
  subject: string;
  previewText?: string | null;
  eyebrow?: string | null;
  blocks: Block[];
}

export interface RenderedIssue {
  html: string;
  text: string;
  /** Exact UTF-8 bytes of this HTML, before provider tracking/personalization. */
  htmlBytes: number;
}

/**
 * The single rendering path. The composer preview, the test send and the
 * broadcast all call this, so there is no way for what an author approves to
 * differ from what is delivered.
 */
export async function renderIssue(
  input: RenderIssueInput,
): Promise<RenderedIssue> {
  const element = NewsletterIssueEmail({
    subject: input.subject,
    previewText: input.previewText ?? undefined,
    eyebrow: input.eyebrow ?? undefined,
    blocks: input.blocks,
  });

  const html = await render(element);
  return {
    html,
    text: toPlainText(html),
    htmlBytes: Buffer.byteLength(html, "utf8"),
  };
}

/**
 * Resend only interpolates merge tags for Broadcasts. Test sends go through the
 * `/emails` endpoint, which does not, so a raw `{{{contact.first_name|there}}}`
 * would reach the tester's inbox verbatim and the unsubscribe link would be a
 * dead `href`. Swap in representative values instead.
 *
 * The unsubscribe placeholder deliberately points at a real, harmless page
 * rather than `#`, so clicking it in a test does not look broken.
 */
export function substituteMergeTags(
  html: string,
  { firstName, unsubscribeUrl }: { firstName: string; unsubscribeUrl: string },
): string {
  return html
    .split(UNSUBSCRIBE_URL_TAG)
    .join(unsubscribeUrl)
    .split(FIRST_NAME_TAG)
    .join(firstName);
}

/**
 * Guards the send path. A broadcast that reaches recipients without a working
 * unsubscribe link is a legal problem, not a rendering nitpick, so this is
 * checked against the rendered output rather than trusting the template.
 */
export function hasUnsubscribeLink(html: string): boolean {
  return html.includes(UNSUBSCRIBE_URL_TAG);
}
