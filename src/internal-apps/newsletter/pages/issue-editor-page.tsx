import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/db/user";
import { env } from "@/env";
import { createMetadata } from "@/lib/metadata";
import { IssueComposer } from "../components/issue-composer";
import { getIssue } from "../db/queries";
import { isAiConfigured } from "../lib/ai";
import { DEFAULT_NEWSLETTER_FROM } from "../lib/config";
import { renderIssue } from "../lib/render";
import {
  isResendConfigured,
  listSegments,
  listTopics,
  sendMode,
} from "../lib/resend";
import { syncIssueStatuses } from "../lib/sync-status";

export const metadata = createMetadata({
  title: "Edit issue",
  description: "Compose a newsletter issue.",
});

/**
 * Thin by design: the composer is a full-screen, two-pane tool that owns its
 * own toolbar and scroll containers, so there is no page chrome to add around
 * it.
 */
export default async function IssueEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await syncIssueStatuses(id);

  const [issue, user] = await Promise.all([getIssue(id), getCurrentUser()]);
  if (!issue) notFound();
  if (!user) redirect("/auth");

  const remoteChoices = isResendConfigured()
    ? Promise.allSettled([listSegments(), listTopics()])
    : null;

  // Rendered here so the preview is populated on first paint rather than after
  // a client round trip.
  const { html, htmlBytes } = await renderIssue({
    subject: issue.subject,
    previewText: issue.previewText,
    blocks: issue.blocks,
  });

  // Segment and topic choices come from Resend, which is the source of truth
  // for them. A failure here must not take the editor down — the settings
  // section just falls back to the configured defaults.
  let segments: { id: string; name: string; isDefault?: boolean }[] = [];
  let topics: { id: string; name: string; isDefault?: boolean }[] = [];

  if (remoteChoices) {
    const [remoteSegments, remoteTopics] = await remoteChoices;
    if (remoteSegments.status === "fulfilled")
      segments = remoteSegments.value.map((s) => ({
        ...s,
        isDefault: s.id === env.RESEND_NEWSLETTER_SEGMENT_ID,
      }));
    if (remoteTopics.status === "fulfilled")
      topics = remoteTopics.value.map((t) => ({
        ...t,
        isDefault: t.id === env.RESEND_NEWSLETTER_TOPIC_ID,
      }));
  }

  return (
    <IssueComposer
      key={issue.id}
      issue={issue}
      editable={issue.status === "draft"}
      aiEnabled={isAiConfigured()}
      mode={sendMode()}
      defaultTestRecipient={user.email ?? ""}
      initialPreviewHtml={html}
      initialPreviewHtmlBytes={htmlBytes}
      segments={segments}
      topics={topics}
      defaultFrom={DEFAULT_NEWSLETTER_FROM}
      currentUserId={user.id}
    />
  );
}
