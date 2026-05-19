import { relations } from "drizzle-orm";
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

// Define relations here to avoid circular dependencies between schema files

export const legalMembershipRelations = relations(
  legalMembership,
  ({ one }) => ({
    user: one(user, {
      fields: [legalMembership.userId],
      references: [user.id],
    }),
    membershipApplication: one(membershipApplication, {
      fields: [legalMembership.id],
      references: [membershipApplication.legalMembershipId],
    }),
  }),
);

export const usersRelations = relations(user, ({ one, many }) => ({
  batch: one(batch, { fields: [user.batchNumber], references: [batch.number] }),
  usersToGroups: many(usersToGroups),
  organizationPositions: many(userOrganizationPosition),
  accessGrants: many(userAccessGrant),
  membershipPayments: many(membershipPayments),
  legalMemberships: many(legalMembership),
  membershipApplications: many(membershipApplication),
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
  membershipApplication,
  membershipApplicationRelations,
  membershipApplicationStatus,
  gocardlessProcessedEvents,
  emailSuppression,
  emailSuppressionReason,
};

export * from "./auth";
export * from "./authority";
export * from "./batch";
export * from "./email-suppression";
export * from "./gocardless-processed-events";
export * from "./group";
export * from "./legal-membership";
export * from "./membership-application";
export * from "./membership-payments";
