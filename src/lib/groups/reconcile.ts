import "server-only";

import { and, eq, inArray, or, type SQL } from "drizzle-orm";
import db from "@/db";
import {
  addUsersToGroup,
  removeUserFromGroups,
  removeUsersFromGroup,
} from "@/db/groups";
import type { Department, UserStatus } from "@/db/schema/auth";
import { user } from "@/db/schema/auth";
import { group, groupCriteria, usersToGroups } from "@/db/schema/group";
import {
  addGroupMember,
  removeGroupMember,
} from "@/lib/google-workspace/directory";
import {
  inviteToChannel,
  kickFromChannel,
  lookupSlackUserIdByEmail,
} from "@/lib/slack";

export interface GroupForReconcile {
  id: string;
  slackChannelId: string | null;
  googleGroupEmail: string | null;
}

export interface ReconcileResult {
  groupId: string;
  group: GroupForReconcile;
  addedUsers: { id: string; email: string }[];
  removedUsers: { id: string; email: string }[];
}

interface MatchableUser {
  id: string;
  email: string;
  department: Department | null;
  status: UserStatus;
  batchNumber: number | null;
}

interface CriterionRow {
  department: Department | null;
  status: UserStatus | null;
  batchNumber: number | null;
}

function criterionHasAnyField(c: CriterionRow): boolean {
  return c.department !== null || c.status !== null || c.batchNumber !== null;
}

function userMatchesCriterion(u: MatchableUser, c: CriterionRow): boolean {
  if (!criterionHasAnyField(c)) return false;
  if (c.department !== null && c.department !== u.department) return false;
  if (c.status !== null && c.status !== u.status) return false;
  if (c.batchNumber !== null && c.batchNumber !== u.batchNumber) return false;
  return true;
}

function userMatchesAnyCriterion(
  u: MatchableUser,
  criteria: CriterionRow[],
): boolean {
  return criteria.some((c) => userMatchesCriterion(u, c));
}

export async function pushAddToIntegrations(
  g: GroupForReconcile,
  email: string,
): Promise<void> {
  if (g.slackChannelId) {
    const slackUserId = await lookupSlackUserIdByEmail(email);
    if (slackUserId) {
      await inviteToChannel(g.slackChannelId, [slackUserId]);
    }
  }

  if (g.googleGroupEmail) {
    await addGroupMember(g.googleGroupEmail, email);
  }
}

export async function pushRemoveToIntegrations(
  g: GroupForReconcile,
  email: string,
): Promise<void> {
  if (g.slackChannelId) {
    const slackUserId = await lookupSlackUserIdByEmail(email);
    if (slackUserId) {
      await kickFromChannel(g.slackChannelId, slackUserId);
    }
  }

  if (g.googleGroupEmail) {
    await removeGroupMember(g.googleGroupEmail, email);
  }
}

function buildMatchingWhereClause(
  criteria: CriterionRow[],
): SQL<unknown> | undefined {
  const clauses = criteria
    .filter(criterionHasAnyField)
    .map((c) => {
      const parts: SQL<unknown>[] = [];
      if (c.department !== null) parts.push(eq(user.department, c.department));
      if (c.status !== null) parts.push(eq(user.status, c.status));
      if (c.batchNumber !== null)
        parts.push(eq(user.batchNumber, c.batchNumber));
      return parts.length === 1 ? parts[0] : and(...parts);
    })
    .filter((c): c is SQL<unknown> => c !== undefined);

  if (clauses.length === 0) return undefined;
  return clauses.length === 1 ? clauses[0] : or(...clauses);
}

/**
 * Reconcile a single group's membership against its current criteria.
 * Only mutates the database — integration pushes are the caller's responsibility.
 */
export async function reconcileGroupMembership(
  groupId: string,
): Promise<ReconcileResult> {
  const g = await db.query.group.findFirst({
    where: eq(group.id, groupId),
    columns: { id: true, slackChannelId: true, googleGroupEmail: true },
  });
  if (!g) {
    return {
      groupId,
      group: { id: groupId, slackChannelId: null, googleGroupEmail: null },
      addedUsers: [],
      removedUsers: [],
    };
  }

  const criteria = await db
    .select({
      department: groupCriteria.department,
      status: groupCriteria.status,
      batchNumber: groupCriteria.batchNumber,
    })
    .from(groupCriteria)
    .where(eq(groupCriteria.groupId, groupId));

  const whereClause = buildMatchingWhereClause(criteria);

  const matching = whereClause
    ? await db
        .select({
          id: user.id,
          email: user.email,
          department: user.department,
          status: user.status,
          batchNumber: user.batchNumber,
        })
        .from(user)
        .where(whereClause)
    : [];
  const matchingIds = new Set(matching.map((u) => u.id));

  const currentMembers = await db
    .select({
      userId: usersToGroups.userId,
      source: usersToGroups.source,
      email: user.email,
    })
    .from(usersToGroups)
    .innerJoin(user, eq(usersToGroups.userId, user.id))
    .where(eq(usersToGroups.groupId, groupId));

  const currentMemberIds = new Set(currentMembers.map((m) => m.userId));

  const toAdd = matching.filter((u) => !currentMemberIds.has(u.id));
  const toRemove = currentMembers.filter(
    (m) => m.source === "criteria" && !matchingIds.has(m.userId),
  );

  if (toAdd.length > 0) {
    await addUsersToGroup({
      groupId,
      userIds: toAdd.map((u) => u.id),
      source: "criteria",
    });
  }

  await removeUsersFromGroup(
    toRemove.map((m) => m.userId),
    groupId,
  );

  return {
    groupId,
    group: g,
    addedUsers: toAdd.map((u) => ({ id: u.id, email: u.email })),
    removedUsers: toRemove.map((m) => ({ id: m.userId, email: m.email })),
  };
}

/**
 * Reconcile a single user's membership across every group that has at
 * least one criterion. Only mutates the database — integration pushes are
 * the caller's responsibility.
 */
export async function reconcileUserGroupMembership(
  userId: string,
): Promise<ReconcileResult[]> {
  const u = await db
    .select({
      id: user.id,
      email: user.email,
      department: user.department,
      status: user.status,
      batchNumber: user.batchNumber,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (u.length === 0) return [];
  const subject = u[0];

  const groupsWithCriteria = await db
    .selectDistinct({
      id: group.id,
      slackChannelId: group.slackChannelId,
      googleGroupEmail: group.googleGroupEmail,
    })
    .from(group)
    .innerJoin(groupCriteria, eq(groupCriteria.groupId, group.id));

  if (groupsWithCriteria.length === 0) return [];

  const groupIds = groupsWithCriteria.map((g) => g.id);

  const allCriteria = await db
    .select({
      groupId: groupCriteria.groupId,
      department: groupCriteria.department,
      status: groupCriteria.status,
      batchNumber: groupCriteria.batchNumber,
    })
    .from(groupCriteria)
    .where(inArray(groupCriteria.groupId, groupIds));

  const criteriaByGroup = new Map<string, CriterionRow[]>();
  for (const c of allCriteria) {
    const list = criteriaByGroup.get(c.groupId) ?? [];
    list.push({
      department: c.department,
      status: c.status,
      batchNumber: c.batchNumber,
    });
    criteriaByGroup.set(c.groupId, list);
  }

  const currentMemberships = await db
    .select({
      groupId: usersToGroups.groupId,
      source: usersToGroups.source,
    })
    .from(usersToGroups)
    .where(
      and(
        eq(usersToGroups.userId, userId),
        inArray(usersToGroups.groupId, groupIds),
      ),
    );

  const currentByGroup = new Map(
    currentMemberships.map((m) => [m.groupId, m] as const),
  );

  const results: ReconcileResult[] = [];
  const groupIdsToRemoveFrom: string[] = [];

  for (const g of groupsWithCriteria) {
    const criteria = criteriaByGroup.get(g.id) ?? [];
    const matches = userMatchesAnyCriterion(subject, criteria);
    const current = currentByGroup.get(g.id);

    if (matches && !current) {
      await addUsersToGroup({
        groupId: g.id,
        userIds: [userId],
        source: "criteria",
      });
      results.push({
        groupId: g.id,
        group: g,
        addedUsers: [{ id: userId, email: subject.email }],
        removedUsers: [],
      });
    } else if (!matches && current?.source === "criteria") {
      groupIdsToRemoveFrom.push(g.id);
      results.push({
        groupId: g.id,
        group: g,
        addedUsers: [],
        removedUsers: [{ id: userId, email: subject.email }],
      });
    }
  }

  if (groupIdsToRemoveFrom.length > 0) {
    await removeUserFromGroups(userId, groupIdsToRemoveFrom);
  }

  return results;
}
