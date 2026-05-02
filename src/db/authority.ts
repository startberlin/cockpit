import { eq, inArray } from "drizzle-orm";
import { newId } from "@/lib/id";
import type {
  GrantAssignment,
  PositionAssignment,
  UserAuthority,
} from "@/lib/permissions";
import { authorityUpdateInputSchema } from "@/lib/permissions/authority-assignments";
import db from ".";
import { user } from "./schema/auth";
import { userAccessGrant, userOrganizationPosition } from "./schema/authority";

export async function getUserAuthority(
  userId: string,
): Promise<UserAuthority | null> {
  const authorityUser = await db.query.user.findFirst({
    where: (users, { eq }) => eq(users.id, userId),
    columns: {
      id: true,
      status: true,
      department: true,
    },
    with: {
      organizationPositions: true,
      accessGrants: true,
    },
  });

  if (!authorityUser) {
    return null;
  }

  return {
    userId: authorityUser.id,
    status: authorityUser.status,
    department: authorityUser.department,
    positions: authorityUser.organizationPositions.map((assignment) => ({
      position: assignment.position,
      scope: assignment.scope,
      department: assignment.department,
    })),
    grants: authorityUser.accessGrants.map((assignment) => ({
      grant: assignment.grant,
      scope: assignment.scope,
      department: assignment.department,
    })),
  };
}

export async function getUsersAuthority(
  userIds: string[],
): Promise<UserAuthority[]> {
  if (userIds.length === 0) {
    return [];
  }

  const users = await db.query.user.findMany({
    where: inArray(user.id, userIds),
    columns: {
      id: true,
      status: true,
      department: true,
    },
    with: {
      organizationPositions: true,
      accessGrants: true,
    },
  });

  return users.map((authorityUser) => ({
    userId: authorityUser.id,
    status: authorityUser.status,
    department: authorityUser.department,
    positions: authorityUser.organizationPositions.map((assignment) => ({
      position: assignment.position,
      scope: assignment.scope,
      department: assignment.department,
    })),
    grants: authorityUser.accessGrants.map((assignment) => ({
      grant: assignment.grant,
      scope: assignment.scope,
      department: assignment.department,
    })),
  }));
}

export async function listUserAuthorities(): Promise<UserAuthority[]> {
  const users = await db.query.user.findMany({
    columns: {
      id: true,
      status: true,
      department: true,
    },
    with: {
      organizationPositions: true,
      accessGrants: true,
    },
  });

  return users.map((authorityUser) => ({
    userId: authorityUser.id,
    status: authorityUser.status,
    department: authorityUser.department,
    positions: authorityUser.organizationPositions.map((assignment) => ({
      position: assignment.position,
      scope: assignment.scope,
      department: assignment.department,
    })),
    grants: authorityUser.accessGrants.map((assignment) => ({
      grant: assignment.grant,
      scope: assignment.scope,
      department: assignment.department,
    })),
  }));
}

export async function replaceUserAuthority(input: {
  userId: string;
  positions: PositionAssignment[];
  grants: GrantAssignment[];
}) {
  const authorityInput = authorityUpdateInputSchema.parse(input);

  await db.transaction(async (tx) => {
    await tx
      .delete(userOrganizationPosition)
      .where(eq(userOrganizationPosition.userId, authorityInput.userId));
    await tx
      .delete(userAccessGrant)
      .where(eq(userAccessGrant.userId, authorityInput.userId));

    if (authorityInput.positions.length > 0) {
      await tx.insert(userOrganizationPosition).values(
        authorityInput.positions.map((assignment) => ({
          id: newId("authorityPosition"),
          userId: authorityInput.userId,
          position: assignment.position,
          scope: assignment.scope,
          department: assignment.department,
        })),
      );
    }

    if (authorityInput.grants.length > 0) {
      await tx.insert(userAccessGrant).values(
        authorityInput.grants.map((assignment) => ({
          id: newId("accessGrant"),
          userId: authorityInput.userId,
          grant: assignment.grant,
          scope: assignment.scope,
          department: assignment.department,
        })),
      );
    }
  });
}
