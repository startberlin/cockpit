import { eq, sql } from "drizzle-orm";
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
import db from ".";
import { legalMembership } from "./schema";
import type { Department } from "./schema/auth";
import { user as userTable } from "./schema/auth";
import {
  type AccessGrant as SchemaAccessGrant,
  type AuthorityScope as SchemaAuthorityScope,
  type OrganizationPosition as SchemaOrganizationPosition,
  userAccessGrant,
  userOrganizationPosition,
} from "./schema/authority";

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
    };
  }

  if (
    assignment.scope === "department" &&
    isDepartmentHeadPosition(assignment.position) &&
    assignment.department !== null
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
  if (globalAccessGrants.includes(assignment.grant)) {
    return { grant: assignment.grant };
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

export interface PositionHolder {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface PositionAssignments {
  president: PositionHolder | null;
  vice_president: PositionHolder | null;
  head_of_finance: PositionHolder | null;
  departmentHeads: Partial<Record<Department, PositionHolder | null>>;
}

export async function getPositionAssignments(): Promise<PositionAssignments> {
  const rows = await db.query.userOrganizationPosition.findMany({
    columns: { position: true, scope: true, department: true },
    with: {
      user: {
        columns: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  const result: PositionAssignments = {
    president: null,
    vice_president: null,
    head_of_finance: null,
    departmentHeads: {},
  };

  for (const row of rows) {
    const holder: PositionHolder = {
      userId: row.user.id,
      firstName: row.user.firstName,
      lastName: row.user.lastName,
      email: row.user.email,
    };
    if (row.scope === "global") {
      if (
        row.position === "president" ||
        row.position === "vice_president" ||
        row.position === "head_of_finance"
      ) {
        result[row.position] = holder;
      }
    } else if (
      row.scope === "department" &&
      row.position === "department_head" &&
      row.department
    ) {
      result.departmentHeads[row.department as Department] = holder;
    }
  }

  return result;
}

export async function getEligibleUsersForPositions(): Promise<
  PositionHolder[]
> {
  return db
    .select({
      userId: userTable.id,
      firstName: userTable.firstName,
      lastName: userTable.lastName,
      email: userTable.email,
    })
    .from(userTable)
    .innerJoin(legalMembership, eq(userTable.id, legalMembership.userId))
    .where(eq(legalMembership.status, "active"))
    .orderBy(userTable.lastName, userTable.firstName);
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Stable advisory lock key for position writes — prevents concurrent saves from corrupting state
const POSITIONS_LOCK_KEY = 42_000_001;

export async function replacePositionAssignments(
  assignments: PositionAssignments,
  externalTx?: Tx,
): Promise<void> {
  const doWork = async (tx: Tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${POSITIONS_LOCK_KEY})`);

    await tx.delete(userOrganizationPosition);

    const rows: Array<{
      userId: string;
      position: SchemaOrganizationPosition;
      scope: SchemaAuthorityScope;
      department: Department | null;
    }> = [];

    for (const pos of [
      "president",
      "vice_president",
      "head_of_finance",
    ] as const) {
      const holder = assignments[pos];
      if (holder) {
        rows.push({
          userId: holder.userId,
          position: pos,
          scope: "global",
          department: null,
        });
      }
    }

    for (const [dept, holder] of Object.entries(assignments.departmentHeads)) {
      if (holder) {
        rows.push({
          userId: holder.userId,
          position: "department_head",
          scope: "department",
          department: dept as Department,
        });
      }
    }

    if (rows.length > 0) {
      await tx.insert(userOrganizationPosition).values(rows);
    }
  };

  if (externalTx) {
    await doWork(externalTx);
  } else {
    await db.transaction(doWork);
  }
}

export async function replaceUserGrants(
  userId: string,
  grants: Array<{ grant: SchemaAccessGrant }>,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(userAccessGrant).where(eq(userAccessGrant.userId, userId));

    if (grants.length > 0) {
      await tx
        .insert(userAccessGrant)
        .values(grants.map((g) => ({ userId, grant: g.grant })));
    }
  });
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
          userId: authorityInput.userId,
          grant: assignment.grant,
        })),
      );
    }
  });
}
