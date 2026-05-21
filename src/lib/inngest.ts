import "server-only";

import { eventType, Inngest, staticSchema } from "inngest";
import { endpointAdapter } from "inngest/next";
import type { Department, UserStatus } from "@/db/schema/auth";

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
      value: "yes" | "no";
      castAt: string;
    }>(),
  }),
  applicationSubmitted: eventType("membership/application.submitted", {
    schema: staticSchema<{ legalMembershipId: string }>(),
  }),
  reconfirmationSubmitted: eventType("membership/reconfirmation.submitted", {
    schema: staticSchema<{ legalMembershipId: string; userId: string }>(),
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
  positionAssignmentCreated: eventType("settings/position-assignment.created", {
    schema: staticSchema<{
      email: string;
      firstName: string;
      positionLabel: string;
    }>(),
  }),
  positionAssignmentDeleted: eventType("settings/position-assignment.deleted", {
    schema: staticSchema<{
      email: string;
      firstName: string;
      positionLabel: string;
    }>(),
  }),
  cancellationRequested: eventType("membership/cancellation.requested", {
    schema: staticSchema<{
      userId: string;
      transitionRequestId: string;
      requiresAcknowledgement: boolean;
      reason: "resigned" | "removed_by_board";
    }>(),
  }),
  cancellationRetracted: eventType("membership/cancellation.retracted", {
    schema: staticSchema<{
      transitionRequestId: string;
    }>(),
  }),
  cancellationAcknowledged: eventType("membership/cancellation.acknowledged", {
    schema: staticSchema<{
      transitionRequestId: string;
      acknowledgedByUserId: string;
    }>(),
  }),
  transitionRequested: eventType("membership/transition.requested", {
    schema: staticSchema<{
      userId: string;
      transitionRequestId: string;
      type: "alumni_request" | "supporting_alumni_request";
      keepPersonalEmail: boolean;
    }>(),
  }),
  transitionRetracted: eventType("membership/transition.retracted", {
    schema: staticSchema<{
      transitionRequestId: string;
    }>(),
  }),
  transitionDecided: eventType("membership/transition.decided", {
    schema: staticSchema<{
      transitionRequestId: string;
      decision: "approved" | "rejected";
      decidedByUserId: string;
    }>(),
  }),
};

export const inngest = new Inngest({
  id: "start-cockpit",
  endpointAdapter,
  checkpointing: {
    maxRuntime: 240, // 4 minutes
  },
});
