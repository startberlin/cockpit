import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import db from "@/db";
import { addUsersToGroup, removeUserFromGroup } from "@/db/groups";
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

export interface ReconcileResult {
  groupId: string;
  added: string[];
  removed: string[];
}

interface GroupForReconcile {
  id: string;
  slackChannelId: string | null;
  googleGroupEmail: string | null;
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

async function pushAddToIntegrations(
  g: GroupForReconcile,
  email: string,
): Promise<void> {
  if (g.slackChannelId) {
    try {
      const slackUserId = await lookupSlackUserIdByEmail(email);
      if (slackUserId) {
        await inviteToChannel(g.slackChannelId, [slackUserId]);
      }
    } catch (error) {
      console.error(
        `[reconcile] Slack invite failed for ${email} in channel ${g.slackChannelId}`,
        error,
      );
    }
  }

  if (g.googleGroupEmail) {
    try {
      await addGroupMember(g.googleGroupEmail, email);
    } catch (error) {
      console.error(
        `[reconcile] Google group add failed for ${email} in ${g.googleGroupEmail}`,
        error,
      );
    }
  }
}

async function pushRemoveToIntegrations(
  g: GroupForReconcile,
  email: string,
): Promise<void> {
  if (g.slackChannelId) {
    try {
      const slackUserId = await lookupSlackUserIdByEmail(email);
      if (slackUserId) {
        await kickFromChannel(g.slackChannelId, slackUserId);
      }
    } catch (error) {
      console.error(
        `[reconcile] Slack kick failed for ${email} in channel ${g.slackChannelId}`,
        error,
      );
    }
  }

  if (g.googleGroupEmail) {
    try {
      await removeGroupMember(g.googleGroupEmail, email);
    } catch (error) {
      console.error(
        `[reconcile] Google group remove failed for ${email} in ${g.googleGroupEmail}`,
        error,
      );
    }
  }
}

/**
 * Reconcile a single group's membership against its current criteria:
 * add users that match but aren't members, remove users whose membership
 * was criterion-driven and no longer matches. Manual memberships are
 * never auto-removed regardless of match state.
 */
export async function reconcileGroupMembership(
  groupId: string,
): Promise<ReconcileResult> {
  const g = await db.query.group.findFirst({
    where: eq(group.id, groupId),
    columns: { id: true, slackChannelId: true, googleGroupEmail: true },
  });
  if (!g) return { groupId, added: [], removed: [] };

  const criteria = await db
    .select({
      department: groupCriteria.department,
      status: groupCriteria.status,
      batchNumber: groupCriteria.batchNumber,
    })
    .from(groupCriteria)
    .where(eq(groupCriteria.groupId, groupId));

  if (criteria.length === 0) return { groupId, added: [], removed: [] };

  const allUsers = await db
    .select({
      id: user.id,
      email: user.email,
      department: user.department,
      status: user.status,
      batchNumber: user.batchNumber,
    })
    .from(user);

  const matching = allUsers.filter((u) => userMatchesAnyCriterion(u, criteria));
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

  for (const m of toRemove) {
    await removeUserFromGroup(m.userId, groupId);
  }

  for (const u of toAdd) {
    await pushAddToIntegrations(g, u.email);
  }
  for (const m of toRemove) {
    await pushRemoveToIntegrations(g, m.email);
  }

  return {
    groupId,
    added: toAdd.map((u) => u.id),
    removed: toRemove.map((m) => m.userId),
  };
}

/**
 * Reconcile a single user's membership across every group that has at
 * least one criterion. Adds the user where they newly match, removes
 * them where their `criteria` row no longer matches.
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
      await pushAddToIntegrations(g, subject.email);
      results.push({ groupId: g.id, added: [userId], removed: [] });
    } else if (!matches && current?.source === "criteria") {
      await removeUserFromGroup(userId, g.id);
      await pushRemoveToIntegrations(g, subject.email);
      results.push({ groupId: g.id, added: [], removed: [userId] });
    }
  }

  return results;
}
