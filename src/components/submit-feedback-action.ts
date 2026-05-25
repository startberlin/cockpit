"use server";

import { z } from "zod";
import { FeedbackSubmitted } from "@/emails/feedback/feedback-submitted";
import { actionClient } from "@/lib/action-client";
import { sendEmail } from "@/lib/email";
import { getSystemGroupBySlug } from "@/lib/groups/system-groups";

const FROM =
  "Cockpit Feedback <no-reply@notification.cockpit.start-berlin.com>";

const CATEGORY_LABEL = {
  bug: "Something is broken",
  suggestion: "Suggestion",
  other: "Something else",
} as const;

const schema = z.object({
  category: z.enum(["bug", "suggestion", "other"]),
  description: z.string().trim().min(1).max(5000),
  pageUrl: z.string().url().nullable(),
  sessionId: z.string().nullable(),
  sessionReplayUrl: z.string().nullable(),
});

export const submitFeedbackAction = actionClient
  .inputSchema(schema)
  .action(async ({ ctx, parsedInput }) => {
    const { category, description, pageUrl, sessionId, sessionReplayUrl } =
      parsedInput;

    const group = getSystemGroupBySlug("cockpit-feedback");
    if (!group) {
      throw new Error("cockpit-feedback system group is not configured");
    }

    const fullName = `${ctx.user.firstName} ${ctx.user.lastName}`.trim();
    const fromEmail = ctx.user.email ?? "(no email on account)";
    const label = CATEGORY_LABEL[category];

    await sendEmail({
      from: FROM,
      to: group.googleGroupEmail,
      subject: `[Cockpit] ${label} — ${fullName}`,
      react: FeedbackSubmitted({
        category,
        description,
        submittedBy: { name: fullName, email: fromEmail },
        pageUrl,
        sessionId,
        sessionReplayUrl,
      }),
    });

    return { success: true };
  });
