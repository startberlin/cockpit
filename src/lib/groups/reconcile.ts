import "server-only";

import { and, eq, inArray, isNull, ne, or, type SQL } from "drizzle-orm";
import db from "@/db";
import {
  addUsersToGroup,
  removeUserFromGroups,
  removeUsersFromGroup,
} from "@/db/groups";
import { SYSTEM_USER_EMAIL } from "@/db/people";
import { user } from "@/db/schema/auth";
import { group, groupCriteria, usersToGroups } from "@/db/schema/group";
import { buildRuleGroupSQL } from "./rule-sql";

export interface GroupForReconcile {
  id: string;
  googleGroupEmail: string | null;
}

export interface ReconcileResult {
  groupId: string;
  group: GroupForReconcile;
  addedUsers: { id: string; email: string | null }[];
  removedUsers: { id: string; email: string | null }[];
}

function buildGroupWhereClause(
  criteria: { conditions: Parameters<typeof buildRuleGroupSQL>[0] }[],
): SQL<unknown> | undefined {
  const clauses = criteria
    .map((c) => buildRuleGroupSQL(c.conditions))
    .filter((c): c is SQL<unknown> => c !== undefined);

  if (clauses.length === 0) return undefined;
  return clauses.length === 1 ? clauses[0] : or(...clauses);
}

/**
 * Reconcile a single group's membership against its current criteria.
 * Only mutates the database — Google sync is the caller's responsibility.
 */
export async function reconcileGroupMembership(
  groupId: string,
): Promise<ReconcileResult> {
  const g = await db.query.group.findFirst({
    where: eq(group.id, groupId),
    columns: { id: true, googleGroupEmail: true },
  });
  if (!g) {
    return {
      groupId,
      group: { id: groupId, googleGroupEmail: null },
      addedUsers: [],
      removedUsers: [],
    };
  }

  const criteria = await db
    .select({ conditions: groupCriteria.conditions })
    .from(groupCriteria)
    .where(eq(groupCriteria.groupId, groupId));

  const whereClause = buildGroupWhereClause(criteria);

  const matching = whereClause
    ? await db
        .select({ id: user.id, email: user.email })
        .from(user)
        .where(
          and(
            whereClause,
            or(isNull(user.email), ne(user.email, SYSTEM_USER_EMAIL)),
          ),
        )
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
 * least one criterion. Only mutates the database — Google sync is the
 * caller's responsibility.
 */
export async function reconcileUserGroupMembership(
  userId: string,
): Promise<ReconcileResult[]> {
  const userRows = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (userRows.length === 0) return [];
  const subject = userRows[0];

  const groupsWithCriteria = await db
    .selectDistinct({
      id: group.id,
      googleGroupEmail: group.googleGroupEmail,
    })
    .from(group)
    .innerJoin(groupCriteria, eq(groupCriteria.groupId, group.id));

  if (groupsWithCriteria.length === 0) return [];

  const groupIds = groupsWithCriteria.map((g) => g.id);

  const allCriteria = await db
    .select({
      groupId: groupCriteria.groupId,
      conditions: groupCriteria.conditions,
    })
    .from(groupCriteria)
    .where(inArray(groupCriteria.groupId, groupIds));

  const criteriaByGroup = new Map<
    string,
    { conditions: Parameters<typeof buildRuleGroupSQL>[0] }[]
  >();
  for (const c of allCriteria) {
    const list = criteriaByGroup.get(c.groupId) ?? [];
    list.push({ conditions: c.conditions });
    criteriaByGroup.set(c.groupId, list);
  }

  const currentMemberships = await db
    .select({ groupId: usersToGroups.groupId, source: usersToGroups.source })
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

  // Check per-group match in parallel — each group has its own WHERE clause
  const matchResults = await Promise.all(
    groupsWithCriteria.map(async (g) => {
      const criteria = criteriaByGroup.get(g.id) ?? [];
      const whereClause = buildGroupWhereClause(criteria);

      if (!whereClause) return { groupId: g.id, matches: false };

      const [row] = await db
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.id, userId), whereClause))
        .limit(1);

      return { groupId: g.id, matches: row !== undefined };
    }),
  );

  const matchesByGroup = new Map(
    matchResults.map((r) => [r.groupId, r.matches]),
  );

  const results: ReconcileResult[] = [];
  const groupIdsToRemoveFrom: string[] = [];

  for (const g of groupsWithCriteria) {
    const matches = matchesByGroup.get(g.id) ?? false;
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
