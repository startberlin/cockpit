import { relations } from "drizzle-orm";
import { auditLog, auditLogRelations } from "./audit-log";
import { account, session, user, verification } from "./auth";
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
  group,
  groupCriteria,
  groupCriteriaRelations,
  groupRelations,
  usersToGroups,
  usersToGroupsRelations,
} from "./group";
import {
  legalMembership,
  legalMembershipDocumentStatus,
  legalMembershipRelations,
  legalMembershipState,
} from "./legal-membership";
import {
  membershipPayment,
  membershipPaymentRelations,
  membershipPaymentStatus,
} from "./membership";
import { workflow, workflowRelations, workflowStatus } from "./workflow";

// Define user relations here to avoid circular dependency
export const usersRelations = relations(user, ({ one, many }) => ({
  batch: one(batch, { fields: [user.batchNumber], references: [batch.number] }),
  usersToGroups: many(usersToGroups),
  organizationPositions: many(userOrganizationPosition),
  accessGrants: many(userAccessGrant),
  legalMembership: one(legalMembership, {
    fields: [user.id],
    references: [legalMembership.userId],
  }),
  membershipPayment: one(membershipPayment, {
    fields: [user.id],
    references: [membershipPayment.userId],
  }),
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
  legalMembership,
  legalMembershipRelations,
  legalMembershipState,
  legalMembershipDocumentStatus,
  workflow,
  workflowStatus,
  workflowRelations,
  auditLog,
  auditLogRelations,
};
