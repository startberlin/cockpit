import { and, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { actionClient } from "@/lib/action-client";
import db from ".";
import type { PublicUser } from "./people";
import { user } from "./schema/auth";
import { group, groupRole, usersToGroups } from "./schema/group";

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
}

export interface GroupDetail {
  id: string;
  name: string;
  slug: string;
  members: GroupMember[];
}

export const getAllGroups = actionClient.action(
  async ({ ctx }): Promise<PublicGroup[]> => {
    const userId = ctx.user.id;

    const groups = await db
      .select({
        id: group.id,
        name: group.name,
        slug: group.slug,
        memberCount: sql<number>`count(${usersToGroups.userId})::int`,
        adminCount: sql<number>`count(case when ${usersToGroups.role} = 'admin' then 1 end)::int`,
        isMember: sql<boolean>`bool_or(${usersToGroups.userId} = ${userId})`,
      })
      .from(group)
      .leftJoin(usersToGroups, eq(group.id, usersToGroups.groupId))
      .groupBy(group.id);

    return groups.map((g) => ({
      ...g,
      isMember: g.isMember ?? false,
    }));
  },
);

export const getMyGroups = actionClient.action(
  async (): Promise<PublicGroup[]> => {
    const allGroups = await getAllGroups();
    if (!allGroups.data) {
      return [];
    }
    return allGroups.data.filter((g) => g.isMember);
  },
);

export async function checkSlugAvailability(slug: string): Promise<boolean> {
  const existing = await db
    .select({ id: group.id })
    .from(group)
    .where(eq(group.slug, slug))
    .limit(1);

  return existing.length === 0;
}

// Raw database function for use in server components
export async function getGroupDetailRaw(
  id: string,
): Promise<GroupDetail | null> {
  const groupData = await db
    .select({
      id: group.id,
      name: group.name,
      slug: group.slug,
    })
    .from(group)
    .where(eq(group.id, id))
    .limit(1);

  if (!groupData.length) return null;

  const members = await db
    .select({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      department: user.department,
      status: user.status,
      batchNumber: sql<number>`${user.batchNumber}`,
      role: usersToGroups.role,
    })
    .from(usersToGroups)
    .innerJoin(user, eq(usersToGroups.userId, user.id))
    .where(eq(usersToGroups.groupId, id))
    .orderBy(usersToGroups.role, user.firstName, user.lastName);

  return {
    ...groupData[0],
    members: members,
  };
}

const getGroupDetailSchema = z.object({
  id: z.string(),
});

export const getGroupDetail = actionClient
  .inputSchema(getGroupDetailSchema)
  .action(async ({ parsedInput }): Promise<GroupDetail | null> => {
    return await getGroupDetailRaw(parsedInput.id);
  });

// Raw database functions for use in server actions
export async function searchUsersNotInGroupRaw(
  groupId: string,
  query?: string,
) {
  const baseQuery = db
    .select({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      department: user.department,
      status: user.status,
      batchNumber: sql<number>`${user.batchNumber}`,
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

export async function addUserToGroupRaw(
  userId: string,
  groupId: string,
  role: "admin" | "member" = "member",
) {
  await db.insert(usersToGroups).values({
    userId,
    groupId,
    role,
  });
}

export async function removeUserFromGroupRaw(userId: string, groupId: string) {
  await db
    .delete(usersToGroups)
    .where(
      and(eq(usersToGroups.userId, userId), eq(usersToGroups.groupId, groupId)),
    );
}

export async function updateUserGroupRoleRaw(
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

// Action client versions for use in components (deprecated for these functions)
const searchUsersNotInGroupSchema = z.object({
  groupId: z.string(),
  query: z.string(),
});

export const searchUsersNotInGroup = actionClient
  .inputSchema(searchUsersNotInGroupSchema)
  .action(async ({ parsedInput }) => {
    return searchUsersNotInGroupRaw(parsedInput.groupId, parsedInput.query);
  });

const addUserToGroupSchema = z.object({
  userId: z.string(),
  groupId: z.string(),
  role: z.enum(["admin", "member"]).optional(),
});

export const addUserToGroup = actionClient
  .inputSchema(addUserToGroupSchema)
  .action(async ({ parsedInput }) => {
    await addUserToGroupRaw(
      parsedInput.userId,
      parsedInput.groupId,
      parsedInput.role,
    );
  });

const removeUserFromGroupSchema = z.object({
  userId: z.string(),
  groupId: z.string(),
});

export const removeUserFromGroup = actionClient
  .inputSchema(removeUserFromGroupSchema)
  .action(async ({ parsedInput }) => {
    await removeUserFromGroupRaw(parsedInput.userId, parsedInput.groupId);
  });

const updateUserGroupRoleSchema = z.object({
  userId: z.string(),
  groupId: z.string(),
  role: z.enum(["admin", "member"]),
});

export const updateUserGroupRole = actionClient
  .inputSchema(updateUserGroupRoleSchema)
  .action(async ({ parsedInput }) => {
    await updateUserGroupRoleRaw(
      parsedInput.userId,
      parsedInput.groupId,
      parsedInput.role,
    );
  });
