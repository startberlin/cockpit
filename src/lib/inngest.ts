import "server-only";

import { eventType, Inngest, staticSchema } from "inngest";
import type { Department, UserStatus } from "@/db/schema/auth";
import type { BoardVoteValue } from "@/db/schema/board-admission";

export const events = {
  userCreated: eventType("user.created", {
    schema: staticSchema<{
      firstName: string;
      lastName: string;
      personalEmail: string;
      companyEmail: string;
      batchNumber?: number;
      department?: Department | null;
      status: UserStatus;
    }>(),
  }),
  slackUserJoined: eventType("slack/user.joined", {
    schema: staticSchema<{ id: string }>(),
  }),
  cockpitUserUpdated: eventType("cockpit/user.updated", {
    schema: staticSchema<{ id: string }>(),
  }),
  groupCreated: eventType("group.created", {
    schema: staticSchema<{
      id: string;
      name: string;
      slug: string;
      integrations: { slack: boolean; email: boolean };
    }>(),
  }),
  admissionWorkflowStarted: eventType("membership/admission-workflow.started", {
    schema: staticSchema<{
      legalMembershipId: string;
      subjectUserId: string;
    }>(),
  }),
  boardVoteCast: eventType("membership/board-vote.cast", {
    schema: staticSchema<{
      legalMembershipId: string;
      voterId: string;
      value: BoardVoteValue;
      castAt: string;
    }>(),
  }),
  applicationSubmitted: eventType("membership/application.submitted", {
    schema: staticSchema<{ legalMembershipId: string }>(),
  }),
  reconfirmationSubmitted: eventType("membership/reconfirmation.submitted", {
    schema: staticSchema<{ legalMembershipId: string }>(),
  }),
  existingMemberDocumentationRequested: eventType(
    "membership/existing-member-documentation.requested",
    {
      schema: staticSchema<{
        userId: string;
        legalMembershipId: string;
      }>(),
    },
  ),
};

export const inngest = new Inngest({
  id: "start-cockpit",
});
