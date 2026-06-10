import { and, count, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { unaccentSearch } from "@/lib/search";
import db from ".";
import { type PublicUser, SYSTEM_USER_EMAIL } from "./people";
import { user } from "./schema/auth";
import { group, usersToGroups } from "./schema/group";
import { getCurrentUser } from "./user";

export interface PublicGroup {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  isMember: boolean;
  googleGroupEmail: string | null;
}

export interface GroupMember extends PublicUser {
  personalEmail: string | null;
  eventEmailPreference: "personal_email" | "start_email" | "custom" | null;
  role: "member" | "manager";
}

export interface GroupManager {
  id: string;
  firstName: string | null;
  lastName: string | null;
  image: string | null;
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
  isMember: boolean;
  isGroupManager: boolean;
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
  const whereClause = search ? unaccentSearch(search, group.name) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: group.id,
        name: group.name,
        slug: group.slug,
        memberCount: sql<number>`(count(${usersToGroups.userId}) filter (where ${user.email} is null or ${user.email} != ${SYSTEM_USER_EMAIL}))::int`,
        isMember: sql<boolean>`bool_or(${usersToGroups.userId} = ${viewerId})`,
        googleGroupEmail: group.googleGroupEmail,
      })
      .from(group)
      .leftJoin(usersToGroups, eq(group.id, usersToGroups.groupId))
      .leftJoin(user, eq(usersToGroups.userId, user.id))
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
      isMember: g.isMember ?? false,
      googleGroupEmail: g.googleGroupEmail ?? null,
    })),
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
      googleGroupEmail: group.googleGroupEmail,
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

  return rows.map((g) => ({
    ...g,
    isMember: true,
    googleGroupEmail: g.googleGroupEmail ?? null,
  }));
}

export async function listManualGroupsForUser(
  userId: string,
): Promise<
  { id: string; name: string; slug: string; googleGroupEmail: string | null }[]
> {
  return db
    .select({
      id: group.id,
      name: group.name,
      slug: group.slug,
      googleGroupEmail: group.googleGroupEmail,
    })
    .from(usersToGroups)
    .innerJoin(group, eq(usersToGroups.groupId, group.id))
    .where(eq(usersToGroups.userId, userId))
    .orderBy(group.name);
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
        .select({ userId: usersToGroups.userId, role: usersToGroups.role })
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
  const isGroupManager = viewerMembership[0]?.role === "manager";
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
      role: usersToGroups.role,
    })
    .from(usersToGroups)
    .innerJoin(user, eq(usersToGroups.userId, user.id))
    .where(
      and(
        eq(usersToGroups.groupId, id),
        or(isNull(user.email), ne(user.email, SYSTEM_USER_EMAIL)),
      ),
    )
    .$dynamic();

  const [groupData, members, [{ totalMembers }]] = await Promise.all([
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
      .innerJoin(user, eq(usersToGroups.userId, user.id))
      .where(
        and(
          eq(usersToGroups.groupId, id),
          or(isNull(user.email), ne(user.email, SYSTEM_USER_EMAIL)),
        ),
      ),
  ]);

  if (!groupData.length) return null;

  return {
    ...groupData[0],
    members,
    totalMembers,
    memberPageCount: Math.ceil(totalMembers / MEMBERS_PAGE_SIZE),
    isMember,
    isGroupManager,
  };
}

export async function getAllGroupMembersForExport(id: string): Promise<
  {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    personalEmail: string | null;
    eventEmailPreference: "personal_email" | "start_email" | "custom" | null;
    eventInviteEmail: string | null;
  }[]
> {
  return db
    .select({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      personalEmail: user.personalEmail,
      eventEmailPreference: user.eventEmailPreference,
      eventInviteEmail: user.eventInviteEmail,
    })
    .from(usersToGroups)
    .innerJoin(user, eq(usersToGroups.userId, user.id))
    .where(
      and(
        eq(usersToGroups.groupId, id),
        or(isNull(user.email), ne(user.email, SYSTEM_USER_EMAIL)),
      ),
    )
    .orderBy(user.firstName, user.lastName);
}

export async function getAllGroupMembersForPhoneExport(id: string): Promise<
  {
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
  }[]
> {
  return db
    .select({
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
    })
    .from(usersToGroups)
    .innerJoin(user, eq(usersToGroups.userId, user.id))
    .where(
      and(
        eq(usersToGroups.groupId, id),
        or(isNull(user.email), ne(user.email, SYSTEM_USER_EMAIL)),
      ),
    )
    .orderBy(user.firstName, user.lastName);
}

export async function listAllUsersNotInGroup(groupId: string) {
  const notSystemUser = or(
    isNull(user.email),
    ne(user.email, SYSTEM_USER_EMAIL),
  );

  return db
    .select({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      image: user.image,
      department: user.department,
      status: user.status,
      batchNumber: sql<number | null>`${user.batchNumber}`,
      legalMembershipState: user.legalMembershipState,
    })
    .from(user)
    .leftJoin(
      usersToGroups,
      and(
        eq(usersToGroups.userId, user.id),
        eq(usersToGroups.groupId, groupId),
      ),
    )
    .where(and(sql`${usersToGroups.userId} IS NULL`, notSystemUser))
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

  const notSystemUser = or(
    isNull(user.email),
    ne(user.email, SYSTEM_USER_EMAIL),
  );

  const whereCondition =
    query && query.length >= 2
      ? and(
          sql`${usersToGroups.userId} IS NULL`,
          notSystemUser,
          unaccentSearch(
            query,
            user.firstName,
            user.lastName,
            user.email,
            sql`${user.firstName} || ' ' || ${user.lastName}`,
          ),
        )
      : and(sql`${usersToGroups.userId} IS NULL`, notSystemUser);

  const usersNotInGroup = await baseQuery
    .where(whereCondition)
    .orderBy(user.firstName, user.lastName)
    .limit(20);

  return usersNotInGroup;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function addUsersToGroup({
  groupId,
  userIds,
  tx,
}: {
  groupId: string;
  userIds: string[];
  tx?: Tx;
}) {
  if (userIds.length === 0) {
    return 0;
  }

  const ops = tx ?? db;

  const values = userIds.map((userId) => ({
    userId,
    groupId,
  }));

  const inserted = await ops
    .insert(usersToGroups)
    .values(values)
    .onConflictDoNothing()
    .returning({ userId: usersToGroups.userId });

  return inserted.length;
}

export async function addUserToGroup(userId: string, groupId: string) {
  await addUsersToGroup({ groupId, userIds: [userId] });
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

export interface AdminGroup {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  emailEnabled: boolean;
  googleGroupEmail: string | null;
  googleSyncPending: boolean;
  managers: GroupManager[];
}

export interface AdminGroupsResult {
  groups: AdminGroup[];
  total: number;
}

export async function listAllGroupsForAdmin({
  search = "",
}: {
  search?: string;
} = {}): Promise<AdminGroupsResult> {
  const whereClause = search ? unaccentSearch(search, group.name) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: group.id,
        name: group.name,
        slug: group.slug,
        memberCount: sql<number>`(count(${usersToGroups.userId}) filter (where ${user.email} is null or ${user.email} != ${SYSTEM_USER_EMAIL}))::int`,
        emailEnabled: group.emailEnabled,
        googleGroupEmail: group.googleGroupEmail,
        googleSyncPending: group.googleSyncPending,
      })
      .from(group)
      .leftJoin(usersToGroups, eq(group.id, usersToGroups.groupId))
      .leftJoin(user, eq(usersToGroups.userId, user.id))
      .where(whereClause)
      .groupBy(group.id)
      .orderBy(group.name),
    db.select({ total: count() }).from(group).where(whereClause),
  ]);

  const groupIds = rows.map((g) => g.id);
  const managerRows =
    groupIds.length > 0
      ? await db
          .select({
            groupId: usersToGroups.groupId,
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            image: user.image,
          })
          .from(usersToGroups)
          .innerJoin(user, eq(usersToGroups.userId, user.id))
          .where(
            and(
              inArray(usersToGroups.groupId, groupIds),
              eq(usersToGroups.role, "manager"),
              or(isNull(user.email), ne(user.email, SYSTEM_USER_EMAIL)),
            ),
          )
      : [];

  const managersByGroupId = new Map<string, GroupManager[]>();
  for (const m of managerRows) {
    const list = managersByGroupId.get(m.groupId) ?? [];
    list.push({
      id: m.id,
      firstName: m.firstName,
      lastName: m.lastName,
      image: m.image,
    });
    managersByGroupId.set(m.groupId, list);
  }

  return {
    groups: rows.map((g) => ({
      ...g,
      googleGroupEmail: g.googleGroupEmail ?? null,
      managers: managersByGroupId.get(g.id) ?? [],
    })),
    total,
  };
}

export async function updateUserRoleInGroup(
  userId: string,
  groupId: string,
  role: "member" | "manager",
) {
  await db
    .update(usersToGroups)
    .set({ role })
    .where(
      and(eq(usersToGroups.userId, userId), eq(usersToGroups.groupId, groupId)),
    );
}
