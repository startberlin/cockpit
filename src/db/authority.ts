import { and, eq, isNull, ne, or, sql } from "drizzle-orm";
import { cache } from "react";
import {
  type AuthorityUpdateInput,
  authorityUpdateInputSchema,
} from "@/lib/authority/assignments";
import {
  type AuthorityScope,
  type DepartmentLeadPosition,
  type GlobalOrganizationPosition,
  type GrantAssignment,
  globalAccessGrants,
  globalOrganizationPositions,
  isDepartmentLeadPosition,
  type OrganizationPosition,
  type PositionAssignment,
  type UserAuthority,
} from "@/lib/authority/model";
import db from ".";
import { SYSTEM_USER_EMAIL } from "./people";
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

function isDepartmentLeadOrgPosition(
  position: OrganizationPosition,
): position is DepartmentLeadPosition {
  return isDepartmentLeadPosition(position);
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
    isDepartmentLeadOrgPosition(assignment.position) &&
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
  email: string | null;
}

export interface PositionAssignments {
  president: PositionHolder | null;
  vice_president: PositionHolder | null;
  head_of_finance: PositionHolder | null;
  // At most one head per department...
  departmentHeads: Partial<Record<Department, PositionHolder | null>>;
  // ...but any number of co-leads.
  departmentCoLeads: Partial<Record<Department, PositionHolder[]>>;
}

export async function getPositionAssignments(
  tx?: Tx,
): Promise<PositionAssignments> {
  const rows = await (tx ?? db).query.userOrganizationPosition.findMany({
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
    departmentCoLeads: {},
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
    } else if (row.scope === "department" && row.department) {
      const dept = row.department as Department;
      if (row.position === "department_head") {
        result.departmentHeads[dept] = holder;
      } else if (row.position === "department_co_lead") {
        const coLeads = result.departmentCoLeads[dept] ?? [];
        coLeads.push(holder);
        result.departmentCoLeads[dept] = coLeads;
      }
    }
  }

  return result;
}

/**
 * The department leads (the optional head plus any co-leads) for a department,
 * excluding the subject themselves and de-duplicated by userId. Head and
 * co-leads hold the same authority and are included in the same workflows.
 */
export function getDepartmentLeads(
  positions: PositionAssignments,
  department: Department | null | undefined,
  excludeUserId?: string,
): PositionHolder[] {
  if (!department) return [];

  const leads = [
    positions.departmentHeads[department] ?? null,
    ...(positions.departmentCoLeads[department] ?? []),
  ];

  const byUserId = new Map<string, PositionHolder>();
  for (const lead of leads) {
    if (lead && lead.userId !== excludeUserId && !byUserId.has(lead.userId)) {
      byUserId.set(lead.userId, lead);
    }
  }

  return [...byUserId.values()];
}

export function getApprovalRecipients(
  positions: PositionAssignments,
  userId: string,
  department: Department | null | undefined,
): PositionHolder[] {
  const deptLeads = getDepartmentLeads(positions, department, userId);

  if (deptLeads.length > 0) {
    return deptLeads;
  }

  return [
    positions.president,
    positions.vice_president,
    positions.head_of_finance,
  ].filter((p): p is PositionHolder => p !== null && p.userId !== userId);
}

export function getFyiRecipients(
  positions: PositionAssignments,
  userId: string,
  department: Department | null | undefined,
): PositionHolder[] {
  const boardByUserId = new Map<string, PositionHolder>();
  for (const p of [
    positions.president,
    positions.vice_president,
    positions.head_of_finance,
  ]) {
    if (p && p.userId !== userId && !boardByUserId.has(p.userId)) {
      boardByUserId.set(p.userId, p);
    }
  }
  const boardMembers = [...boardByUserId.values()];

  const deptLeadsToInclude = getDepartmentLeads(
    positions,
    department,
    userId,
  ).filter((lead) => !boardByUserId.has(lead.userId));

  if (deptLeadsToInclude.length === 0) return boardMembers;

  return [...boardMembers, ...deptLeadsToInclude];
}

export async function getFinanceAdminUsers(): Promise<PositionHolder[]> {
  return db
    .select({
      userId: userTable.id,
      firstName: userTable.firstName,
      lastName: userTable.lastName,
      email: userTable.email,
    })
    .from(userAccessGrant)
    .innerJoin(userTable, eq(userTable.id, userAccessGrant.userId))
    .where(eq(userAccessGrant.grant, "finance_admin"));
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
    .where(
      and(
        eq(legalMembership.status, "active"),
        or(isNull(userTable.email), ne(userTable.email, SYSTEM_USER_EMAIL)),
      ),
    )
    .orderBy(userTable.lastName, userTable.firstName);
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Stable advisory lock key for position writes — prevents concurrent saves from corrupting state
export const POSITIONS_LOCK_KEY = 42_000_001;

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

    for (const [dept, holders] of Object.entries(
      assignments.departmentCoLeads,
    )) {
      for (const holder of holders ?? []) {
        rows.push({
          userId: holder.userId,
          position: "department_co_lead",
          scope: "department",
          department: dept as Department,
        });
      }
    }

    if (rows.length > 0) {
      await tx.insert(userOrganizationPosition).values(rows);
    }

    // Sync each position holder's department field. Dept heads/co-leads are
    // processed first so that a board assignment on the same user overrides to
    // null.
    const departmentUpdates = new Map<string, Department | null>();

    for (const [dept, holder] of Object.entries(assignments.departmentHeads)) {
      if (holder) {
        departmentUpdates.set(holder.userId, dept as Department);
      }
    }

    for (const [dept, holders] of Object.entries(
      assignments.departmentCoLeads,
    )) {
      for (const holder of holders ?? []) {
        departmentUpdates.set(holder.userId, dept as Department);
      }
    }

    for (const pos of [
      "president",
      "vice_president",
      "head_of_finance",
    ] as const) {
      const holder = assignments[pos];
      if (holder) {
        departmentUpdates.set(holder.userId, null);
      }
    }

    for (const [userId, department] of departmentUpdates) {
      await tx
        .update(userTable)
        .set({ department })
        .where(eq(userTable.id, userId));
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
