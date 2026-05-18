import "server-only";

import { eventType, Inngest, staticSchema } from "inngest";
import { endpointAdapter } from "inngest/next";
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
  cockpitUserUpdated: eventType("cockpit/user.updated", {
    schema: staticSchema<{ id: string }>(),
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
  groupCriteriaChanged: eventType("group/criteria.changed", {
    schema: staticSchema<{ groupId: string }>(),
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
  endpointAdapter,
  checkpointing: {
    maxRuntime: 240, // 4 minutes
  },
});
