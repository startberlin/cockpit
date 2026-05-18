import { and, eq, ilike, inArray, or, type SQL, sql } from "drizzle-orm";
import { z } from "zod";
import {
  type AddGroupCriteriaInput,
  addGroupCriteriaSchema,
  type NormalizedGroupCriteriaInput,
  normalizedGroupCriteriaSchema,
} from "@/lib/groups/criteria";
import { nanoid } from "@/lib/id";
import { can } from "@/lib/permissions/server";
import db from ".";
import type { PublicUser } from "./people";
import type { Department, UserStatus } from "./schema/auth";
import { user } from "./schema/auth";
import {
  group,
  groupCriteria,
  type groupMembershipSource,
  usersToGroups,
} from "./schema/group";
import { getCurrentUser } from "./user";

type GroupMembershipSource = (typeof groupMembershipSource.enumValues)[number];

export interface PublicGroup {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  adminCount: number;
  isMember: boolean;
}

export interface GroupMember extends PublicUser {
  role: "admin" | "member";
  source: GroupMembershipSource;
}

export interface GroupDetail {
  id: string;
  name: string;
  slug: string;
  members: GroupMember[];
  criteria: GroupCriteria[];
}

export async function canViewGroup(groupId: string): Promise<boolean> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return false;
  }

  if (await can("groups.view_all")) {
    return true;
  }

  const membership = await db
    .select({ userId: usersToGroups.userId })
    .from(usersToGroups)
    .where(
      and(
        eq(usersToGroups.groupId, groupId),
        eq(usersToGroups.userId, currentUser.id),
      ),
    )
    .limit(1);

  return membership.length > 0;
}

export async function listGroupsForViewer(
  viewerId: string,
): Promise<PublicGroup[]> {
  const groups = await db
    .select({
      id: group.id,
      name: group.name,
      slug: group.slug,
      memberCount: sql<number>`count(${usersToGroups.userId})::int`,
      adminCount: sql<number>`count(case when ${usersToGroups.role} = 'admin' then 1 end)::int`,
      isMember: sql<boolean>`bool_or(${usersToGroups.userId} = ${viewerId})`,
    })
    .from(group)
    .leftJoin(usersToGroups, eq(group.id, usersToGroups.groupId))
    .groupBy(group.id);

  return groups.map((g) => ({
    ...g,
    isMember: g.isMember ?? false,
  }));
}

export async function listMemberGroupsForViewer(
  viewerId: string,
): Promise<PublicGroup[]> {
  const groups = await listGroupsForViewer(viewerId);
  return groups.filter((g) => g.isMember);
}

export async function checkSlugAvailability(slug: string): Promise<boolean> {
  const existing = await db
    .select({ id: group.id })
    .from(group)
    .where(eq(group.slug, slug))
    .limit(1);

  return existing.length === 0;
}

export async function getGroupDetail(id: string): Promise<GroupDetail | null> {
  const canManage = await can("groups.manage_members");

  const [groupData, members, criteria] = await Promise.all([
    db
      .select({
        id: group.id,
        name: group.name,
        slug: group.slug,
      })
      .from(group)
      .where(eq(group.id, id))
      .limit(1),
    db
      .select({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        department: user.department,
        status: user.status,
        batchNumber: sql<number | null>`${user.batchNumber}`,
        role: usersToGroups.role,
        source: usersToGroups.source,
      })
      .from(usersToGroups)
      .innerJoin(user, eq(usersToGroups.userId, user.id))
      .where(eq(usersToGroups.groupId, id))
      .orderBy(usersToGroups.role, user.firstName, user.lastName),
    canManage
      ? db.query.groupCriteria.findMany({
          where: eq(groupCriteria.groupId, id),
          orderBy: (groupCriteria, { desc }) => [desc(groupCriteria.createdAt)],
        })
      : Promise.resolve([]),
  ]);

  if (!groupData.length) return null;

  return {
    ...groupData[0],
    members,
    criteria,
  };
}

export async function searchUsersNotInGroup(groupId: string, query?: string) {
  const baseQuery = db
    .select({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      department: user.department,
      status: user.status,
      batchNumber: sql<number | null>`${user.batchNumber}`,
    })
    .from(user)
    .leftJoin(
      usersToGroups,
      and(
        eq(usersToGroups.userId, user.id),
        eq(usersToGroups.groupId, groupId),
      ),
    );

  // If query provided, filter by search term
  const whereCondition =
    query && query.length >= 2
      ? and(
          sql`${usersToGroups.userId} IS NULL`,
          or(
            ilike(user.firstName, `%${query}%`),
            ilike(user.lastName, `%${query}%`),
            ilike(user.email, `%${query}%`),
            ilike(
              sql`${user.firstName} || ' ' || ${user.lastName}`,
              `%${query}%`,
            ),
          ),
        )
      : sql`${usersToGroups.userId} IS NULL`;

  const usersNotInGroup = await baseQuery
    .where(whereCondition)
    .orderBy(user.firstName, user.lastName)
    .limit(20);

  return usersNotInGroup;
}

export async function addUserToGroup(
  userId: string,
  groupId: string,
  role: "admin" | "member" = "member",
  source: GroupMembershipSource = "manual",
) {
  await addUsersToGroup({ groupId, userIds: [userId], role, source });
}

export async function removeUserFromGroup(userId: string, groupId: string) {
  await db
    .delete(usersToGroups)
    .where(
      and(eq(usersToGroups.userId, userId), eq(usersToGroups.groupId, groupId)),
    );
}

export async function removeUsersFromGroup(userIds: string[], groupId: string) {
  if (userIds.length === 0) return;
  await db
    .delete(usersToGroups)
    .where(
      and(
        inArray(usersToGroups.userId, userIds),
        eq(usersToGroups.groupId, groupId),
      ),
    );
}

export async function updateUserGroupRole(
  userId: string,
  groupId: string,
  role: "admin" | "member",
) {
  await db
    .update(usersToGroups)
    .set({ role })
    .where(
      and(eq(usersToGroups.userId, userId), eq(usersToGroups.groupId, groupId)),
    );
}

export async function pinGroupMember(userId: string, groupId: string) {
  await db
    .update(usersToGroups)
    .set({ source: "manual" })
    .where(
      and(eq(usersToGroups.userId, userId), eq(usersToGroups.groupId, groupId)),
    );
}

// Group Criteria Types and Interfaces
export interface GroupCriteria {
  id: string;
  name: string;
  department: Department | null;
  status: UserStatus | null;
  batchNumber: number | null;
  createdAt: Date;
  createdBy: string;
}

export async function getGroupCriteria(
  groupId: string,
): Promise<GroupCriteria[]> {
  return await db.query.groupCriteria.findMany({
    where: eq(groupCriteria.groupId, groupId),
    orderBy: (groupCriteria, { desc }) => [desc(groupCriteria.createdAt)],
  });
}

export type { AddGroupCriteriaInput, NormalizedGroupCriteriaInput };
export { addGroupCriteriaSchema, normalizedGroupCriteriaSchema };

export async function addGroupCriteria(
  input: AddGroupCriteriaInput & { createdBy: string },
  tx?: Parameters<Parameters<typeof db.transaction>[0]>[0],
): Promise<GroupCriteria> {
  const ops = tx ?? db;
  const criteriaId = nanoid();

  const [newCriteria] = await ops
    .insert(groupCriteria)
    .values({
      id: criteriaId,
      groupId: input.groupId,
      name: input.name,
      department: input.department || null,
      status: input.status || null,
      batchNumber: input.batchNumber || null,
      createdBy: input.createdBy,
    })
    .returning();

  return newCriteria;
}

export async function getGroupCriteriaById(
  criteriaId: string,
): Promise<GroupCriteria | null> {
  const row = await db.query.groupCriteria.findFirst({
    where: eq(groupCriteria.id, criteriaId),
  });
  return row ?? null;
}

const removeGroupCriteriaSchema = z.object({
  criteriaId: z.string(),
});

type RemoveGroupCriteriaInput = z.infer<typeof removeGroupCriteriaSchema>;

export async function removeGroupCriteria({
  criteriaId,
}: RemoveGroupCriteriaInput) {
  await db.delete(groupCriteria).where(eq(groupCriteria.id, criteriaId));
}

function buildCriteriaConditions({
  departments,
  statuses,
  batchNumbers,
}: NormalizedGroupCriteriaInput["criteria"]) {
  const conditions: SQL[] = [];

  if (departments.length > 0) {
    conditions.push(inArray(user.department, departments));
  }

  if (statuses.length > 0) {
    conditions.push(inArray(user.status, statuses));
  }

  if (batchNumbers.length > 0) {
    conditions.push(inArray(user.batchNumber, batchNumbers));
  }

  return conditions;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function findUsersNotInGroupByCriteria(
  { groupId, match, criteria }: NormalizedGroupCriteriaInput,
  tx?: Tx,
): Promise<PublicUser[]> {
  const ops = tx ?? db;
  const conditions = buildCriteriaConditions(criteria);

  if (conditions.length === 0) {
    return [];
  }

  const matchCondition =
    match === "all" ? and(...conditions) : or(...conditions);

  return await ops
    .select({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      department: user.department,
      status: user.status,
      batchNumber: sql<number | null>`${user.batchNumber}`,
    })
    .from(user)
    .leftJoin(
      usersToGroups,
      and(
        eq(usersToGroups.userId, user.id),
        eq(usersToGroups.groupId, groupId),
      ),
    )
    .where(and(sql`${usersToGroups.userId} IS NULL`, matchCondition))
    .orderBy(user.firstName, user.lastName);
}

export async function addUsersToGroup({
  groupId,
  userIds,
  role = "member",
  source = "manual",
  tx,
}: {
  groupId: string;
  userIds: string[];
  role?: "admin" | "member";
  source?: GroupMembershipSource;
  tx?: Tx;
}) {
  if (userIds.length === 0) {
    return 0;
  }

  const ops = tx ?? db;

  const values = userIds.map((userId) => ({
    userId,
    groupId,
    role,
    source,
  }));

  if (source === "manual") {
    // Manual adds win over criterion-driven rows: if the user is already in
    // the group with source = 'criteria', upgrade them to 'manual' so future
    // reconciliations can no longer auto-remove them. We deliberately do not
    // touch the role on conflict — that's set by separate explicit actions.
    await ops
      .insert(usersToGroups)
      .values(values)
      .onConflictDoUpdate({
        target: [usersToGroups.userId, usersToGroups.groupId],
        set: { source: "manual" },
      });
  } else {
    // Criterion-driven adds must never downgrade an existing manual row.
    await ops.insert(usersToGroups).values(values).onConflictDoNothing();
  }

  return userIds.length;
}

export async function addUsersMatchingCriteria(
  groupId: string,
  criteria: {
    department?: Department;
    status?: UserStatus;
    batchNumber?: number;
  },
  tx?: Tx,
) {
  const matchingUsers = await findUsersNotInGroupByCriteria(
    {
      groupId,
      match: "all",
      criteria: {
        departments: criteria.department ? [criteria.department] : [],
        statuses: criteria.status ? [criteria.status] : [],
        batchNumbers: criteria.batchNumber ? [criteria.batchNumber] : [],
      },
    },
    tx,
  );

  await addUsersToGroup({
    groupId,
    userIds: matchingUsers.map((matchingUser) => matchingUser.id),
    source: "criteria",
    tx,
  });

  return matchingUsers.length;
}
