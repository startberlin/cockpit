"use server";

import { z } from "zod";
import { FeedbackSubmitted } from "@/emails/feedback/feedback-submitted";
import { actionClient } from "@/lib/action-client";
import { sendEmail } from "@/lib/email";
import { getSystemGroupBySlug } from "@/lib/groups/system-groups";

const FROM =
  "Cockpit Feedback <no-reply@notification.cockpit.start-berlin.com>";

const CATEGORY_LABEL = {
  issue: "Issue",
  idea: "Idea",
  other: "Other",
} as const;

const schema = z.object({
  category: z.enum(["issue", "idea", "other"]),
  description: z.string().trim().min(1).max(5000),
  pageUrl: z.string().url().nullable(),
});

export const submitFeedbackAction = actionClient
  .inputSchema(schema)
  .action(async ({ ctx, parsedInput }) => {
    const { category, description, pageUrl } = parsedInput;

    const group = getSystemGroupBySlug("cockpit-feedback");
    if (!group) {
      throw new Error("cockpit-feedback system group is not configured");
    }

    const fullName = `${ctx.user.firstName} ${ctx.user.lastName}`.trim();
    const fromEmail = ctx.user.email ?? "(no email on account)";

    await sendEmail({
      from: FROM,
      to: group.googleGroupEmail,
      subject: `[Cockpit ${CATEGORY_LABEL[category]}] ${fullName}`,
      react: FeedbackSubmitted({
        category,
        description,
        submittedBy: { name: fullName, email: fromEmail },
        pageUrl,
      }),
    });

    return { success: true };
  });
