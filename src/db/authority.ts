import { eq } from "drizzle-orm";
import { cache } from "react";
import {
  type AuthorityUpdateInput,
  authorityUpdateInputSchema,
} from "@/lib/authority/assignments";
import {
  type AuthorityScope,
  departmentHeadPosition,
  type GlobalOrganizationPosition,
  type GrantAssignment,
  globalAccessGrants,
  globalOrganizationPositions,
  type OrganizationPosition,
  type PositionAssignment,
  type UserAuthority,
} from "@/lib/authority/model";
import { newId } from "@/lib/id";
import db from ".";
import type { Department } from "./schema/auth";
import { userAccessGrant, userOrganizationPosition } from "./schema/authority";

type AuthorityUserRow = NonNullable<
  Awaited<ReturnType<typeof findAuthorityUserById>>
>;

type PersistedPositionAssignment = {
  position: OrganizationPosition;
  scope: AuthorityScope;
  department: Department | null;
};

type PersistedGrantAssignment = {
  grant: GrantAssignment["grant"];
  scope: AuthorityScope;
  department: Department | null;
};

function isGlobalOrganizationPosition(
  position: OrganizationPosition,
): position is GlobalOrganizationPosition {
  return (
    globalOrganizationPositions as readonly OrganizationPosition[]
  ).includes(position);
}

function isDepartmentHeadPosition(
  position: OrganizationPosition,
): position is typeof departmentHeadPosition {
  return position === departmentHeadPosition;
}

async function findAuthorityUserById(userId: string) {
  return db.query.user.findFirst({
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
}

function mapPositionAssignment(
  assignment: PersistedPositionAssignment,
): PositionAssignment {
  if (
    assignment.scope === "global" &&
    isGlobalOrganizationPosition(assignment.position) &&
    assignment.department === null
  ) {
    return {
      position: assignment.position,
      scope: "global",
      department: null,
    };
  }

  if (
    assignment.scope === "department" &&
    isDepartmentHeadPosition(assignment.position) &&
    assignment.department
  ) {
    return {
      position: assignment.position,
      scope: "department",
      department: assignment.department,
    };
  }

  throw new Error("Invalid persisted organization position assignment.");
}

function mapGrantAssignment(
  assignment: PersistedGrantAssignment,
): GrantAssignment {
  if (
    assignment.scope === "global" &&
    globalAccessGrants.includes(assignment.grant) &&
    assignment.department === null
  ) {
    return {
      grant: assignment.grant,
      scope: "global",
      department: null,
    };
  }

  throw new Error("Invalid persisted access grant assignment.");
}

function mapAuthorityUser(authorityUser: AuthorityUserRow): UserAuthority {
  return {
    userId: authorityUser.id,
    status: authorityUser.status,
    department: authorityUser.department,
    positions: authorityUser.organizationPositions.map(mapPositionAssignment),
    grants: authorityUser.accessGrants.map(mapGrantAssignment),
  };
}

// Per-request deduplication only — not a persistent cache
export const getUserAuthority = cache(
  async (userId: string): Promise<UserAuthority | null> => {
    const authorityUser = await findAuthorityUserById(userId);

    if (!authorityUser) {
      return null;
    }

    return mapAuthorityUser(authorityUser);
  },
);

export async function getAllUserAuthorities(): Promise<UserAuthority[]> {
  const authorityUsers = await db.query.user.findMany({
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

  return authorityUsers.map(mapAuthorityUser);
}

export async function replaceUserAuthority(input: AuthorityUpdateInput) {
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
