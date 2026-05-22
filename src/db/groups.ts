import {
  and,
  count,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import {
  type AddGroupCriteriaInput,
  addGroupCriteriaSchema,
  type NormalizedGroupCriteriaInput,
  normalizedGroupCriteriaSchema,
} from "@/lib/groups/criteria";
import type { RuleGroup } from "@/lib/groups/rule";
import { buildRuleGroupSQL } from "@/lib/groups/rule-sql";
import { nanoid } from "@/lib/id";
import { can } from "@/lib/permissions/server";
import db from ".";
import type { PublicUser } from "./people";
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
  isMember: boolean;
}

export interface GroupMember extends PublicUser {
  source: GroupMembershipSource;
  personalEmail: string | null;
  eventEmailPreference: "personal_email" | "start_email" | null;
}

export interface GroupDetail {
  id: string;
  name: string;
  slug: string;
  googleGroupEmail: string | null;
  googleSyncPending: boolean;
  members: GroupMember[];
  totalMembers: number;
  memberPageCount: number;
  criteria: GroupCriteria[];
  isMember: boolean;
}

export interface PaginatedGroups {
  groups: PublicGroup[];
  total: number;
  pageCount: number;
}

const MEMBERS_PAGE_SIZE = 50;
const GROUPS_PAGE_SIZE = 50;

export async function listGroupsForViewer(
  viewerId: string,
  { page = 1, search = "" }: { page?: number; search?: string } = {},
): Promise<PaginatedGroups> {
  const offset = (page - 1) * GROUPS_PAGE_SIZE;
  const whereClause = search ? ilike(group.name, `%${search}%`) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: group.id,
        name: group.name,
        slug: group.slug,
        memberCount: sql<number>`count(${usersToGroups.userId})::int`,
        isMember: sql<boolean>`bool_or(${usersToGroups.userId} = ${viewerId})`,
      })
      .from(group)
      .leftJoin(usersToGroups, eq(group.id, usersToGroups.groupId))
      .where(whereClause)
      .groupBy(group.id)
      .orderBy(group.name)
      .limit(GROUPS_PAGE_SIZE)
      .offset(offset),
    db.select({ total: count() }).from(group).where(whereClause),
  ]);

  return {
    groups: rows.map((g) => ({ ...g, isMember: g.isMember ?? false })),
    total,
    pageCount: Math.ceil(total / GROUPS_PAGE_SIZE),
  };
}

export async function listGroupsPublic(
  viewerId: string,
  { page = 1, search = "" }: { page?: number; search?: string } = {},
): Promise<PaginatedGroups> {
  const offset = (page - 1) * GROUPS_PAGE_SIZE;
  const whereClause = search ? ilike(group.name, `%${search}%`) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: group.id,
        name: group.name,
        slug: group.slug,
        memberCount: sql<number>`count(${usersToGroups.userId})::int`,
        isMember: sql<boolean>`bool_or(${usersToGroups.userId} = ${viewerId})`,
      })
      .from(group)
      .leftJoin(usersToGroups, eq(group.id, usersToGroups.groupId))
      .where(whereClause)
      .groupBy(group.id)
      .orderBy(group.name)
      .limit(GROUPS_PAGE_SIZE)
      .offset(offset),
    db.select({ total: count() }).from(group).where(whereClause),
  ]);

  return {
    groups: rows.map((g) => ({ ...g, isMember: g.isMember ?? false })),
    total,
    pageCount: Math.ceil(total / GROUPS_PAGE_SIZE),
  };
}

export async function listMemberGroupsForViewer(
  viewerId: string,
): Promise<PublicGroup[]> {
  const rows = await db
    .select({
      id: group.id,
      name: group.name,
      slug: group.slug,
      memberCount: sql<number>`count(${usersToGroups.userId})::int`,
      isMember: sql<boolean>`bool_or(${usersToGroups.userId} = ${viewerId})`,
    })
    .from(group)
    .innerJoin(
      usersToGroups,
      and(
        eq(group.id, usersToGroups.groupId),
        eq(usersToGroups.userId, viewerId),
      ),
    )
    .groupBy(group.id)
    .orderBy(group.name);

  return rows.map((g) => ({ ...g, isMember: true }));
}

export async function checkSlugAvailability(slug: string): Promise<boolean> {
  const existing = await db
    .select({ id: group.id })
    .from(group)
    .where(eq(group.slug, slug))
    .limit(1);

  return existing.length === 0;
}

export async function checkGoogleEmailPrefixAvailability(
  prefix: string,
): Promise<boolean> {
  const existing = await db
    .select({ id: group.id })
    .from(group)
    .where(
      or(
        eq(group.googleEmailPrefix, prefix),
        and(isNull(group.googleEmailPrefix), eq(group.slug, prefix)),
      ),
    )
    .limit(1);

  return existing.length === 0;
}

export async function getGroupDetail(
  id: string,
  page = 1,
): Promise<GroupDetail | null> {
  const currentUser = await getCurrentUser();

  const viewerMembership = currentUser
    ? await db
        .select({ userId: usersToGroups.userId })
        .from(usersToGroups)
        .where(
          and(
            eq(usersToGroups.groupId, id),
            eq(usersToGroups.userId, currentUser.id),
          ),
        )
        .limit(1)
    : [];

  const isMember = viewerMembership.length > 0;
  const canManage = await can("group.members.manage", { id });
  const offset = (page - 1) * MEMBERS_PAGE_SIZE;

  const membersBaseQuery = db
    .select({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      image: user.image,
      personalEmail: user.personalEmail,
      eventEmailPreference: user.eventEmailPreference,
      department: user.department,
      status: user.status,
      batchNumber: sql<number | null>`${user.batchNumber}`,
      source: usersToGroups.source,
    })
    .from(usersToGroups)
    .innerJoin(user, eq(usersToGroups.userId, user.id))
    .where(eq(usersToGroups.groupId, id))
    .$dynamic();

  const [groupData, members, [{ totalMembers }], criteria] = await Promise.all([
    db
      .select({
        id: group.id,
        name: group.name,
        slug: group.slug,
        googleGroupEmail: group.googleGroupEmail,
        googleSyncPending: group.googleSyncPending,
      })
      .from(group)
      .where(eq(group.id, id))
      .limit(1),
    membersBaseQuery
      .orderBy(user.firstName, user.lastName)
      .limit(MEMBERS_PAGE_SIZE)
      .offset(offset),
    db
      .select({ totalMembers: count() })
      .from(usersToGroups)
      .where(eq(usersToGroups.groupId, id)),
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
    totalMembers,
    memberPageCount: Math.ceil(totalMembers / MEMBERS_PAGE_SIZE),
    criteria,
    isMember,
  };
}

export async function getAllGroupMembersForExport(id: string): Promise<
  {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    personalEmail: string | null;
    eventEmailPreference: "personal_email" | "start_email" | null;
  }[]
> {
  return db
    .select({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      personalEmail: user.personalEmail,
      eventEmailPreference: user.eventEmailPreference,
    })
    .from(usersToGroups)
    .innerJoin(user, eq(usersToGroups.userId, user.id))
    .where(eq(usersToGroups.groupId, id))
    .orderBy(user.firstName, user.lastName);
}

export async function searchUsersNotInGroup(groupId: string, query?: string) {
  const baseQuery = db
    .select({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      image: user.image,
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
  source: GroupMembershipSource = "manual",
) {
  await addUsersToGroup({ groupId, userIds: [userId], source });
}

export async function removeUserFromGroup(userId: string, groupId: string) {
  await db
    .delete(usersToGroups)
    .where(
      and(eq(usersToGroups.userId, userId), eq(usersToGroups.groupId, groupId)),
    );
}

export async function removeUserFromGroups(userId: string, groupIds: string[]) {
  if (groupIds.length === 0) return;
  await db
    .delete(usersToGroups)
    .where(
      and(
        eq(usersToGroups.userId, userId),
        inArray(usersToGroups.groupId, groupIds),
      ),
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
  groupId: string;
  name: string;
  conditions: RuleGroup;
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
      conditions: input.conditions,
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
      image: user.image,
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
  source = "manual",
  tx,
}: {
  groupId: string;
  userIds: string[];
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
    source,
  }));

  if (source === "manual") {
    // Manual adds win over criterion-driven rows: if the user is already in
    // the group with source = 'criteria', upgrade them to 'manual' so future
    // reconciliations can no longer auto-remove them.
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

export interface AdminGroup {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  emailEnabled: boolean;
  googleGroupEmail: string | null;
  googleSyncPending: boolean;
}

export interface PaginatedAdminGroups {
  groups: AdminGroup[];
  total: number;
  pageCount: number;
}

export async function listAllGroupsForAdmin({
  page = 1,
  search = "",
}: {
  page?: number;
  search?: string;
} = {}): Promise<PaginatedAdminGroups> {
  const offset = (page - 1) * GROUPS_PAGE_SIZE;
  const whereClause = search ? ilike(group.name, `%${search}%`) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: group.id,
        name: group.name,
        slug: group.slug,
        memberCount: sql<number>`count(${usersToGroups.userId})::int`,
        emailEnabled: group.emailEnabled,
        googleGroupEmail: group.googleGroupEmail,
        googleSyncPending: group.googleSyncPending,
      })
      .from(group)
      .leftJoin(usersToGroups, eq(group.id, usersToGroups.groupId))
      .where(whereClause)
      .groupBy(group.id)
      .orderBy(group.name)
      .limit(GROUPS_PAGE_SIZE)
      .offset(offset),
    db.select({ total: count() }).from(group).where(whereClause),
  ]);

  return {
    groups: rows.map((g) => ({
      ...g,
      googleGroupEmail: g.googleGroupEmail ?? null,
    })),
    total,
    pageCount: Math.ceil(total / GROUPS_PAGE_SIZE),
  };
}

export async function addUsersMatchingCriteria(
  groupId: string,
  conditions: RuleGroup,
  tx?: Tx,
): Promise<number> {
  const whereClause = buildRuleGroupSQL(conditions);
  if (!whereClause) return 0;

  const ops = tx ?? db;

  const matching = await ops
    .select({ id: user.id })
    .from(user)
    .leftJoin(
      usersToGroups,
      and(
        eq(usersToGroups.userId, user.id),
        eq(usersToGroups.groupId, groupId),
      ),
    )
    .where(and(sql`${usersToGroups.userId} IS NULL`, whereClause));

  if (matching.length === 0) return 0;

  await addUsersToGroup({
    groupId,
    userIds: matching.map((u) => u.id),
    source: "criteria",
    tx,
  });

  return matching.length;
}
