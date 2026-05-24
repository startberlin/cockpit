import { and, asc, count, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { cache } from "react";
import { DEPARTMENT_NAMES } from "@/lib/departments";
import {
  getStructuredMembershipState,
  type StructuredMembershipState,
} from "@/lib/membership-status";
import { unaccentSearch } from "@/lib/search";
import { getOnboardingProgress } from "@/schema/onboarding-progress";
import db from ".";
import type {
  Department,
  LegalMembershipState,
  UserStatus,
} from "./schema/auth";
import { user as userTable } from "./schema/auth";
import type {
  AccessGrant,
  AuthorityScope,
  OrganizationPosition,
} from "./schema/authority";
import { userOrganizationPosition } from "./schema/authority";
import { group as groupTable, usersToGroups } from "./schema/group";

export interface PublicUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  image: string | null;
  department: Department | null;
  batchNumber: number | null;
  status: UserStatus;
  legalMembershipState?: LegalMembershipState | null;
  memberSinceDate?: string | null;
  positionLabel?: string | null;
  isEligibleForMembershipProposal?: boolean;
}

export interface UserDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  personalEmail: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  department: Department | null;
  batchNumber: number | null;
  status: UserStatus;
  legalMembershipState: LegalMembershipState;
  membershipState: StructuredMembershipState;
  profileOnboardingComplete: boolean;
  hasMembershipPayment: boolean;
  organizationPositions: Array<{
    position: OrganizationPosition;
    scope: AuthorityScope;
    department: Department | null;
  }>;
  accessGrants: Array<{
    grant: AccessGrant;
  }>;
  createdAt: Date;
  groups: Array<{
    id: string;
    name: string;
  }>;
}

export async function getDepartmentHeadForDepartment(
  dept: Department,
): Promise<{
  firstName: string;
  lastName: string;
  image: string | null;
} | null> {
  const row = await db.query.userOrganizationPosition.findFirst({
    where: (t, { eq, and }) =>
      and(eq(t.position, "department_head"), eq(t.department, dept)),
    with: {
      user: { columns: { firstName: true, lastName: true, image: true } },
    },
  });
  return row?.user ?? null;
}

const SYSTEM_USER_EMAIL = "cockpit-system-user@start-berlin.com";

const PEOPLE_PAGE_SIZE = 100;

export interface PaginatedUsers {
  users: PublicUser[];
  total: number;
  pageCount: number;
  offset: number;
}

const DEFAULT_COMMUNITY_STATUSES: UserStatus[] = [
  "onboarding",
  "member",
  "supporting_alumni",
];

export async function getAllUserPublicData({
  page = 1,
  search = "",
  status,
  department,
  batchNumber,
}: {
  page?: number;
  search?: string;
  status?: UserStatus[];
  department?: Department[];
  batchNumber?: number[];
} = {}): Promise<PaginatedUsers> {
  const offset = (page - 1) * PEOPLE_PAGE_SIZE;
  const effectiveStatus = status ?? DEFAULT_COMMUNITY_STATUSES;

  const searchClause = search
    ? unaccentSearch(
        search,
        userTable.firstName,
        userTable.lastName,
        sql`${userTable.firstName} || ' ' || ${userTable.lastName}`,
      )
    : undefined;

  const whereClause = and(
    searchClause,
    inArray(userTable.status, effectiveStatus),
    department?.length ? inArray(userTable.department, department) : undefined,
    batchNumber?.length
      ? inArray(userTable.batchNumber, batchNumber)
      : undefined,
    or(isNull(userTable.email), ne(userTable.email, SYSTEM_USER_EMAIL)),
  );

  const [rows, positionRows, [{ total }]] = await Promise.all([
    db
      .select({
        id: userTable.id,
        firstName: userTable.firstName,
        lastName: userTable.lastName,
        email: userTable.email,
        image: userTable.image,
        department: userTable.department,
        batchNumber: sql<number | null>`${userTable.batchNumber}`,
        status: userTable.status,
      })
      .from(userTable)
      .where(whereClause)
      .orderBy(userTable.firstName, userTable.lastName)
      .limit(PEOPLE_PAGE_SIZE)
      .offset(offset),
    db
      .select({
        userId: userOrganizationPosition.userId,
        position: userOrganizationPosition.position,
        department: userOrganizationPosition.department,
      })
      .from(userOrganizationPosition),
    db.select({ total: count() }).from(userTable).where(whereClause),
  ]);

  const POSITION_PRIORITY: Record<OrganizationPosition, number> = {
    president: 0,
    vice_president: 1,
    head_of_finance: 2,
    department_head: 3,
  };

  const GLOBAL_POSITION_LABELS: Partial<Record<OrganizationPosition, string>> =
    {
      president: "President",
      vice_president: "Vice President",
      head_of_finance: "Head of Finance",
    };

  const posLabelMap = new Map<string, { label: string; priority: number }>();
  for (const p of positionRows) {
    const priority = POSITION_PRIORITY[p.position];
    const label =
      p.position === "department_head"
        ? p.department
          ? `Head of ${DEPARTMENT_NAMES[p.department]}`
          : "Department Head"
        : (GLOBAL_POSITION_LABELS[p.position] ?? p.position);

    const existing = posLabelMap.get(p.userId);
    if (!existing || priority < existing.priority) {
      posLabelMap.set(p.userId, { label, priority });
    }
  }

  return {
    users: rows.map((u) => ({
      id: u.id,
      firstName: u.firstName ?? "",
      lastName: u.lastName ?? "",
      email: u.email ?? "",
      image: u.image ?? null,
      department: u.department ?? null,
      batchNumber: u.batchNumber ?? null,
      status: u.status,
      positionLabel: posLabelMap.get(u.id)?.label ?? null,
    })),
    pageCount: Math.ceil(total / PEOPLE_PAGE_SIZE),
    total,
    offset,
  };
}

const ADMIN_ACTIVE_STATUSES: UserStatus[] = [
  "onboarding",
  "member",
  "supporting_alumni",
];

export async function getAllUsersForAdmin({
  page = 1,
  search = "",
  status,
  department,
  batchNumber,
  legalMembershipState,
  sortBy = "name",
}: {
  page?: number;
  search?: string;
  status?: UserStatus[];
  department?: Department[];
  batchNumber?: number[];
  legalMembershipState?: LegalMembershipState;
  sortBy?: "name" | "joinDate";
} = {}): Promise<PaginatedUsers> {
  const offset = (page - 1) * PEOPLE_PAGE_SIZE;

  const effectiveStatus = status ?? ADMIN_ACTIVE_STATUSES;

  const searchClause = search
    ? unaccentSearch(
        search,
        userTable.firstName,
        userTable.lastName,
        sql`${userTable.firstName} || ' ' || ${userTable.lastName}`,
      )
    : undefined;

  const whereClause = and(
    searchClause,
    inArray(userTable.status, effectiveStatus),
    department?.length ? inArray(userTable.department, department) : undefined,
    batchNumber?.length
      ? inArray(userTable.batchNumber, batchNumber)
      : undefined,
    legalMembershipState !== undefined
      ? eq(userTable.legalMembershipState, legalMembershipState)
      : undefined,
    or(isNull(userTable.email), ne(userTable.email, SYSTEM_USER_EMAIL)),
  );

  const orderBy =
    sortBy === "joinDate"
      ? [
          asc(sql`${userTable.memberSinceDate} NULLS LAST`),
          asc(userTable.createdAt),
        ]
      : [asc(userTable.firstName), asc(userTable.lastName)];

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: userTable.id,
        firstName: userTable.firstName,
        lastName: userTable.lastName,
        email: userTable.email,
        image: userTable.image,
        department: userTable.department,
        batchNumber: sql<number | null>`${userTable.batchNumber}`,
        status: userTable.status,
        legalMembershipState: userTable.legalMembershipState,
        memberSinceDate: userTable.memberSinceDate,
      })
      .from(userTable)
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(PEOPLE_PAGE_SIZE)
      .offset(offset),
    db.select({ total: count() }).from(userTable).where(whereClause),
  ]);

  return {
    users: rows.map((u) => ({
      id: u.id,
      firstName: u.firstName ?? "",
      lastName: u.lastName ?? "",
      email: u.email ?? "",
      image: u.image ?? null,
      department: u.department ?? null,
      batchNumber: u.batchNumber ?? null,
      status: u.status,
      legalMembershipState: u.legalMembershipState,
      memberSinceDate: u.memberSinceDate,
    })),
    pageCount: Math.ceil(total / PEOPLE_PAGE_SIZE),
    total,
    offset,
  };
}

export interface UserDetails {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  image: string | null;
  personalEmail: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  department: Department | null;
  batchNumber: number | null;
  status: UserStatus;
  legalMembershipState: LegalMembershipState;
  membershipState: StructuredMembershipState;
  profileOnboardingComplete: boolean;
  gocardlessMandateId: string | null;
  gocardlessCustomerId: string | null;
  createdAt: Date;
}

export interface UserGroupMembership {
  id: string;
  name: string;
  slug: string;
}

export interface UserGroupMembershipDetail {
  id: string;
  name: string;
  slug: string;
  source: "criteria" | "manual";
  joinedAt: Date;
  memberCount: number;
}

export interface UserAuthorityData {
  id: string;
  organizationPositions: Array<{
    position: OrganizationPosition;
    scope: AuthorityScope;
    department: Department | null;
  }>;
  accessGrants: Array<{
    grant: AccessGrant;
  }>;
}

// Per-request deduplication only — not a persistent cache
export const getUserDetails = cache(
  async (id: string): Promise<UserDetails | null> => {
    const user = await db.query.user.findFirst({
      where: (users, { eq }) => eq(users.id, id),
      columns: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        image: true,
        personalEmail: true,
        phone: true,
        birthDate: true,
        street: true,
        city: true,
        state: true,
        zip: true,
        country: true,
        department: true,
        status: true,
        legalMembershipState: true,
        gocardlessMandateId: true,
        gocardlessCustomerId: true,
        createdAt: true,
        eventEmailPreference: true,
      },
      with: {
        batch: { columns: { number: true } },
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      image: user.image ?? null,
      personalEmail: user.personalEmail,
      phone: user.phone,
      street: user.street,
      city: user.city,
      state: user.state,
      zip: user.zip,
      country: user.country,
      department: user.department ?? null,
      batchNumber: user.batch?.number ?? null,
      status: user.status,
      legalMembershipState: user.legalMembershipState,
      membershipState: getStructuredMembershipState(user),
      profileOnboardingComplete: getOnboardingProgress(user) === "completed",
      gocardlessMandateId: user.gocardlessMandateId ?? null,
      gocardlessCustomerId: user.gocardlessCustomerId ?? null,
      createdAt: user.createdAt,
    };
  },
);

// Per-request deduplication only — not a persistent cache
export const getUserGroupMemberships = cache(
  async (id: string): Promise<UserGroupMembership[]> => {
    const rows = await db.query.usersToGroups.findMany({
      where: (utg, { eq }) => eq(utg.userId, id),
      with: {
        group: { columns: { id: true, name: true, slug: true } },
      },
    });

    return rows.map((row) => ({
      id: row.group.id,
      name: row.group.name,
      slug: row.group.slug,
    }));
  },
);

// Per-request deduplication only — not a persistent cache
export const getUserGroupMembershipsWithDetails = cache(
  async (id: string): Promise<UserGroupMembershipDetail[]> => {
    const memberCountSubquery = db
      .select({ groupId: usersToGroups.groupId, total: count().as("total") })
      .from(usersToGroups)
      .groupBy(usersToGroups.groupId)
      .as("member_counts");

    const rows = await db
      .select({
        id: groupTable.id,
        name: groupTable.name,
        slug: groupTable.slug,
        source: usersToGroups.source,
        joinedAt: usersToGroups.joinedAt,
        memberCount: memberCountSubquery.total,
      })
      .from(usersToGroups)
      .innerJoin(groupTable, eq(usersToGroups.groupId, groupTable.id))
      .innerJoin(
        memberCountSubquery,
        eq(usersToGroups.groupId, memberCountSubquery.groupId),
      )
      .where(eq(usersToGroups.userId, id));

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      source: row.source,
      joinedAt: row.joinedAt,
      memberCount: row.memberCount,
    }));
  },
);

// Per-request deduplication only — not a persistent cache
export const getUserAuthorityData = cache(
  async (id: string): Promise<UserAuthorityData | null> => {
    const user = await db.query.user.findFirst({
      where: (users, { eq }) => eq(users.id, id),
      columns: { id: true },
      with: {
        organizationPositions: {
          columns: { position: true, scope: true, department: true },
        },
        accessGrants: {
          columns: { grant: true },
        },
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      organizationPositions: user.organizationPositions.map((p) => ({
        position: p.position,
        scope: p.scope,
        department: p.department,
      })),
      accessGrants: user.accessGrants.map((g) => ({
        grant: g.grant,
      })),
    };
  },
);

export async function getUserById(id: string): Promise<UserDetail | null> {
  const user = await db.query.user.findFirst({
    where: (users, { eq }) => eq(users.id, id),
    columns: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      personalEmail: true,
      phone: true,
      birthDate: true,
      street: true,
      city: true,
      state: true,
      zip: true,
      country: true,
      department: true,
      status: true,
      legalMembershipState: true,
      gocardlessMandateId: true,
      gocardlessCustomerId: true,
      createdAt: true,
      eventEmailPreference: true,
    },
    with: {
      batch: true,
      usersToGroups: {
        with: {
          group: true,
        },
      },
      organizationPositions: true,
      accessGrants: true,
    },
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    personalEmail: user.personalEmail,
    phone: user.phone,
    street: user.street,
    city: user.city,
    state: user.state,
    zip: user.zip,
    country: user.country,
    department: user.department ?? null,
    batchNumber: user.batch?.number ?? null,
    status: user.status,
    legalMembershipState: user.legalMembershipState,
    membershipState: getStructuredMembershipState(user),
    profileOnboardingComplete: getOnboardingProgress(user) === "completed",
    hasMembershipPayment: !!user.gocardlessMandateId,
    organizationPositions: user.organizationPositions.map((assignment) => ({
      position: assignment.position,
      scope: assignment.scope,
      department: assignment.department,
    })),
    accessGrants: user.accessGrants.map((assignment) => ({
      grant: assignment.grant,
    })),
    createdAt: user.createdAt,
    groups: user.usersToGroups.map((utg) => ({
      id: utg.group.id,
      name: utg.group.name,
    })),
  };
}

// ─── Org chart ────────────────────────────────────────────────────────────────

export interface OrgChartUser {
  id: string;
  firstName: string;
  lastName: string;
  image: string | null;
  department: Department | null;
  batchNumber: number | null;
  status: UserStatus;
  positions: Array<{
    position: OrganizationPosition;
    scope: AuthorityScope;
    department: Department | null;
  }>;
}

const ORG_CHART_STATUSES: UserStatus[] = ["member", "onboarding"];

export async function getOrgChartData(): Promise<OrgChartUser[]> {
  const rows = await db.query.user.findMany({
    where: (u, { inArray, and, ne, isNull, or }) =>
      and(
        inArray(u.status, ORG_CHART_STATUSES),
        or(isNull(u.email), ne(u.email, SYSTEM_USER_EMAIL)),
      ),
    columns: {
      id: true,
      firstName: true,
      lastName: true,
      image: true,
      department: true,
      status: true,
    },
    with: {
      batch: { columns: { number: true } },
      organizationPositions: {
        columns: { position: true, scope: true, department: true },
      },
    },
  });

  return rows.map((u) => ({
    id: u.id,
    firstName: u.firstName ?? "",
    lastName: u.lastName ?? "",
    image: u.image ?? null,
    department: u.department ?? null,
    batchNumber: u.batch?.number ?? null,
    status: u.status,
    positions: u.organizationPositions,
  }));
}
