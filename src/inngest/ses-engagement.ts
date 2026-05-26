import { events, inngest } from "@/lib/inngest";
import { getPostHogClient } from "@/lib/posthog-server";

export const sesEngagementWorkflow = inngest.createFunction(
  {
    id: "ses-engagement-to-posthog",
    name: "SES engagement → PostHog",
    retries: 5,
    triggers: [{ event: events.sesEngagement }],
  },
  async ({ event, step }) => {
    await step.run("capture-in-posthog", async () => {
      const posthog = getPostHogClient();
      if (!posthog) return;

      const { eventType, mail, open, click } = event.data;
      const userId = mail.tags?.userId?.[0];
      const emailType = mail.tags?.emailType?.[0];
      const recipient = mail.destination[0];

      posthog.capture({
        distinctId: userId ?? recipient,
        event: eventType === "Open" ? "email_opened" : "email_link_clicked",
        // SES occasionally emits duplicate events. Deduping by messageId +
        // event type keeps PostHog clean if that happens.
        properties: {
          $insert_id: `${mail.messageId}:${eventType}${click ? `:${click.link}` : ""}`,
          $email: recipient,
          email_subject: mail.commonHeaders?.subject,
          email_type: emailType,
          message_id: mail.messageId,
          timestamp: mail.timestamp,
          ...(click && {
            clicked_url: click.link,
            clicked_url_tags: click.linkTags,
            user_agent: click.userAgent,
          }),
          ...(open && {
            user_agent: open.userAgent,
          }),
        },
      });

      await posthog.flush();
    });
  },
);
