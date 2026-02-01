import { and, eq, ilike, or, type SQL, sql } from "drizzle-orm";
import { z } from "zod";
import { actionClient } from "@/lib/action-client";
import { nanoid } from "@/lib/id";
import db from ".";
import type { PublicUser } from "./people";
import type { Department, Role, UserStatus } from "./schema/auth";
import { user } from "./schema/auth";
import { group, groupCriteria, usersToGroups } from "./schema/group";

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
  criteria: GroupCriteria[];
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

  const criteria = await db.query.groupCriteria.findMany({
    where: eq(groupCriteria.groupId, id),
    orderBy: (groupCriteria, { desc }) => [desc(groupCriteria.createdAt)],
  });

  return {
    ...groupData[0],
    members: members,
    criteria: criteria,
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

// Group Criteria Types and Interfaces
export interface GroupCriteria {
  id: string;
  name: string;
  department: Department | null;
  roles: Role[] | null;
  status: UserStatus | null;
  batchNumber: number | null;
  createdAt: Date;
  createdBy: string;
}

// Get all criteria for a group
export const getGroupCriteria = actionClient
  .inputSchema(z.object({ groupId: z.string() }))
  .action(async ({ parsedInput }): Promise<GroupCriteria[]> => {
    const criteria = await db.query.groupCriteria.findMany({
      where: eq(groupCriteria.groupId, parsedInput.groupId),
      orderBy: (groupCriteria, { desc }) => [desc(groupCriteria.createdAt)],
    });

    return criteria;
  });

// Add new criteria to a group
const addGroupCriteriaSchema = z.object({
  groupId: z.string(),
  name: z.string().min(1, "Criteria name is required"),
  department: z
    .enum(["partnerships", "operations", "community", "growth", "events"])
    .optional(),
  roles: z
    .array(z.enum(["member", "board", "department_lead", "admin"]))
    .optional(),
  status: z
    .enum(["onboarding", "member", "supporting_alumni", "alumni"])
    .optional(),
  batchNumber: z.number().int().positive().optional(),
});

export const addGroupCriteria = actionClient
  .inputSchema(addGroupCriteriaSchema)
  .action(async ({ parsedInput, ctx }): Promise<GroupCriteria> => {
    const criteriaId = nanoid();

    const [newCriteria] = await db
      .insert(groupCriteria)
      .values({
        id: criteriaId,
        groupId: parsedInput.groupId,
        name: parsedInput.name,
        department: parsedInput.department || null,
        roles: parsedInput.roles || null,
        status: parsedInput.status || null,
        batchNumber: parsedInput.batchNumber || null,
        createdBy: ctx.user.id,
      })
      .returning();

    return newCriteria;
  });

// Remove criteria from a group
export const removeGroupCriteria = actionClient
  .inputSchema(z.object({ criteriaId: z.string() }))
  .action(async ({ parsedInput }) => {
    await db
      .delete(groupCriteria)
      .where(eq(groupCriteria.id, parsedInput.criteriaId));
  });

// Find users matching criteria and add them to group
export const addUsersMatchingCriteria = async (
  groupId: string,
  criteria: {
    department?: Department;
    roles?: Role[];
    status?: UserStatus;
    batchNumber?: number;
  },
) => {
  // Build the where conditions dynamically
  const conditions: SQL[] = [];

  if (criteria.department) {
    conditions.push(eq(user.department, criteria.department));
  }

  if (criteria.status) {
    conditions.push(eq(user.status, criteria.status));
  }

  if (criteria.batchNumber) {
    conditions.push(eq(user.batchNumber, criteria.batchNumber));
  }

  // If roles are specified, we need to check if any of the user's roles match
  if (criteria.roles && criteria.roles.length > 0) {
    // Use correct PostgreSQL syntax: value = ANY(array_column)
    const roleConditions = criteria.roles.map(
      (role) => sql`${role} = ANY(${user.roles})`,
    );
    const roleOr = or(...roleConditions);
    if (roleOr) conditions.push(roleOr);
  }

  // Find users matching the criteria who are not already in the group
  const matchingUsers = await db
    .select({
      id: user.id,
    })
    .from(user)
    .leftJoin(
      usersToGroups,
      and(
        eq(usersToGroups.userId, user.id),
        eq(usersToGroups.groupId, groupId),
      ),
    )
    .where(
      and(
        // User matches criteria
        conditions.length > 0 ? and(...conditions) : undefined,
        // User is not already in the group
        sql`${usersToGroups.userId} IS NULL`,
      ),
    );

  // Add all matching users to the group as members
  if (matchingUsers.length > 0) {
    const userGroupEntries = matchingUsers.map((u) => ({
      userId: u.id,
      groupId: groupId,
      role: "member" as const,
    }));

    await db.insert(usersToGroups).values(userGroupEntries);
  }

  return matchingUsers.length;
};
