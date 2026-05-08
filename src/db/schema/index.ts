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
import { admissionParticipant, boardVote } from "./board-admission";
import {
  group,
  groupCriteria,
  groupCriteriaRelations,
  groupRelations,
  usersToGroups,
  usersToGroupsRelations,
} from "./group";
import { legalMembership } from "./legal-membership";
import {
  membershipPayment,
  membershipPaymentRelations,
  membershipPaymentStatus,
} from "./membership";
import { membershipApplication } from "./membership-application";
import { task } from "./task";
import { workflow, workflowRelations, workflowStatus } from "./workflow";

// Define user relations here to avoid circular dependency
export const usersRelations = relations(user, ({ one, many }) => ({
  batch: one(batch, { fields: [user.batchNumber], references: [batch.number] }),
  usersToGroups: many(usersToGroups),
  organizationPositions: many(userOrganizationPosition),
  accessGrants: many(userAccessGrant),
  membershipPayment: one(membershipPayment, {
    fields: [user.id],
    references: [membershipPayment.userId],
  }),
  legalMemberships: many(legalMembership),
  admissionParticipations: many(admissionParticipant),
  boardVotes: many(boardVote),
  membershipApplications: many(membershipApplication),
  tasks: many(task),
  subjectWorkflows: many(workflow, {
    relationName: "workflowSubjectUser",
  }),
  createdWorkflows: many(workflow, {
    relationName: "workflowCreator",
  }),
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
  membershipPayment,
  membershipPaymentRelations,
  membershipPaymentStatus,
  legalMembershipState,
  workflow,
  workflowStatus,
  workflowRelations,
  auditLog,
  auditLogRelations,
};

export * from "./audit-log";
export * from "./auth";
export * from "./authority";
export * from "./batch";
export * from "./board-admission";
export * from "./group";
export * from "./legal-document";
export * from "./legal-membership";
export * from "./membership";
export * from "./membership-application";
export * from "./task";
export * from "./workflow";
