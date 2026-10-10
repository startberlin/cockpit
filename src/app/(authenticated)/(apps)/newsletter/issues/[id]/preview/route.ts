import { getIssue } from "@/internal-apps/newsletter/db/queries";
import { renderIssue } from "@/internal-apps/newsletter/lib/render";
import { can } from "@/lib/permissions/server";

/**
 * The rendered issue as a standalone page, for opening the preview full-screen
 * in its own tab. Same rendering path as the send, so it is a faithful preview
 * rather than an approximation.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await can("apps.newsletter.access"))) {
    return new Response("Not authorized", { status: 403 });
  }

  const { id } = await params;
  const issue = await getIssue(id);
  if (!issue) return new Response("Not found", { status: 404 });

  const { html } = await renderIssue({
    subject: issue.subject,
    previewText: issue.previewText,
    blocks: issue.blocks,
  });

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // A preview of a draft should never be cached anywhere.
      "Cache-Control": "no-store",
    },
  });
}
