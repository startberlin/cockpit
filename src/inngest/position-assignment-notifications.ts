import React from "react";
import { PositionAssignedEmail } from "@/emails/position-assigned";
import { PositionRemovedEmail } from "@/emails/position-removed";
import { sendEmail } from "@/lib/email";
import { events, inngest } from "@/lib/inngest";

export const positionAssignmentCreatedNotification = inngest.createFunction(
  {
    id: "position-assignment-created-notification",
    triggers: [{ event: events.positionAssignmentCreated }],
  },
  async ({ event, step }) => {
    await step.run("send-email", () =>
      sendEmail({
        from: "START Berlin <notifications@cockpit.start-berlin.com>",
        to: event.data.email,
        subject: `You've been assigned as ${event.data.positionLabel} at START Berlin`,
        react: React.createElement(PositionAssignedEmail, {
          firstName: event.data.firstName,
          positionLabel: event.data.positionLabel,
        }),
      }),
    );
  },
);

export const positionAssignmentDeletedNotification = inngest.createFunction(
  {
    id: "position-assignment-deleted-notification",
    triggers: [{ event: events.positionAssignmentDeleted }],
  },
  async ({ event, step }) => {
    await step.run("send-email", () =>
      sendEmail({
        from: "START Berlin <notifications@cockpit.start-berlin.com>",
        to: event.data.email,
        subject: `You've been removed as ${event.data.positionLabel} at START Berlin`,
        react: React.createElement(PositionRemovedEmail, {
          firstName: event.data.firstName,
          positionLabel: event.data.positionLabel,
        }),
      }),
    );
  },
);
