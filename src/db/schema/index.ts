import { relations } from "drizzle-orm";
import { account, session, user, verification } from "./auth";
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
  membershipPayment,
  membershipPaymentRelations,
  membershipPaymentStatus,
} from "./membership";

// Define user relations here to avoid circular dependency
export const usersRelations = relations(user, ({ one, many }) => ({
  batch: one(batch, { fields: [user.batchNumber], references: [batch.number] }),
  usersToGroups: many(usersToGroups),
  membershipPayment: one(membershipPayment, {
    fields: [user.id],
    references: [membershipPayment.userId],
  }),
}));

export const schema = {
  user,
  session,
  account,
  verification,
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
};
