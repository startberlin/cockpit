import { relations } from "drizzle-orm";
import { auditLog, auditLogRelations } from "./audit-log";
import {
  account,
  legalMembershipState,
  session,
  user,
  verification,
} from "./auth";
import {
  accessGrant,
  authorityScope,
  organizationPosition,
  userAccessGrant,
  userAccessGrantRelations,
  userOrganizationPosition,
  userOrganizationPositionRelations,
} from "./authority";
import { batch, batchRelations } from "./batch";
import {
  admissionParticipant,
  admissionParticipantRelations,
  boardResolution,
  boardResolutionRelations,
  boardVote,
  boardVoteRelations,
  boardVoteValue,
  officerFunction,
} from "./board-admission";
import { emailSuppression, emailSuppressionReason } from "./email-suppression";
import { gocardlessProcessedEvents } from "./gocardless-processed-events";
import {
  group,
  groupCriteria,
  groupCriteriaRelations,
  groupRelations,
  usersToGroups,
  usersToGroupsRelations,
} from "./group";
import { legalDocument, legalDocumentRelations } from "./legal-document";
import { legalMembership, legalMembershipStatus } from "./legal-membership";
import {
  membershipApplication,
  membershipApplicationRelations,
  membershipApplicationStatus,
} from "./membership-application";
import {
  membershipPaymentCycleStatus,
  membershipPayments,
  membershipPaymentsRelations,
} from "./membership-payments";
import { task, taskRelations, taskStatus } from "./task";

// Define relations here to avoid circular dependencies between schema files

export const legalMembershipRelations = relations(
  legalMembership,
  ({ one, many }) => ({
    user: one(user, {
      fields: [legalMembership.userId],
      references: [user.id],
    }),
    boardResolution: one(boardResolution, {
      fields: [legalMembership.id],
      references: [boardResolution.legalMembershipId],
    }),
    admissionParticipants: many(admissionParticipant),
    boardVotes: many(boardVote),
    membershipApplication: one(membershipApplication, {
      fields: [legalMembership.id],
      references: [membershipApplication.legalMembershipId],
    }),
    tasks: many(task),
    legalDocuments: many(legalDocument),
  }),
);

export const usersRelations = relations(user, ({ one, many }) => ({
  batch: one(batch, { fields: [user.batchNumber], references: [batch.number] }),
  usersToGroups: many(usersToGroups),
  organizationPositions: many(userOrganizationPosition),
  accessGrants: many(userAccessGrant),
  membershipPayments: many(membershipPayments),
  legalMemberships: many(legalMembership),
  admissionParticipations: many(admissionParticipant),
  boardVotes: many(boardVote),
  membershipApplications: many(membershipApplication),
  tasks: many(task),
  actorAuditLogs: many(auditLog, { relationName: "auditLogActor" }),
  targetAuditLogs: many(auditLog, { relationName: "auditLogTarget" }),
}));

export const schema = {
  user,
  session,
  account,
  verification,
  organizationPosition,
  accessGrant,
  authorityScope,
  userOrganizationPosition,
  userAccessGrant,
  userOrganizationPositionRelations,
  userAccessGrantRelations,
  batch,
  usersRelations,
  batchRelations,
  group,
  groupCriteria,
  usersToGroups,
  groupRelations,
  groupCriteriaRelations,
  usersToGroupsRelations,
  membershipPayments,
  membershipPaymentsRelations,
  membershipPaymentCycleStatus,
  legalMembershipState,
  legalMembership,
  legalMembershipStatus,
  legalMembershipRelations,
  boardResolution,
  boardResolutionRelations,
  admissionParticipant,
  admissionParticipantRelations,
  boardVote,
  boardVoteRelations,
  officerFunction,
  boardVoteValue,
  membershipApplication,
  membershipApplicationRelations,
  membershipApplicationStatus,
  task,
  taskStatus,
  taskRelations,
  legalDocument,
  legalDocumentRelations,
  auditLog,
  auditLogRelations,
  gocardlessProcessedEvents,
  emailSuppression,
  emailSuppressionReason,
};

export * from "./audit-log";
export * from "./auth";
export * from "./authority";
export * from "./batch";
export * from "./board-admission";
export * from "./email-suppression";
export * from "./gocardless-processed-events";
export * from "./group";
export * from "./legal-document";
export * from "./legal-membership";
export * from "./membership-application";
export * from "./membership-payments";
export * from "./task";
