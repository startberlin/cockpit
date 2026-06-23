import {
  and,
  asc,
  count,
  eq,
  exists,
  inArray,
  isNull,
  ne,
  not,
  notExists,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { cache } from "react";
import type { ActionItemType } from "@/lib/action-items";
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
import { account, user as userTable } from "./schema/auth";
import type {
  AccessGrant,
  AuthorityScope,
  OrganizationPosition,
} from "./schema/authority";
import { userOrganizationPosition } from "./schema/authority";
import { group as groupTable, usersToGroups } from "./schema/group";
import { legalMembership } from "./schema/legal-membership";

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
  id: string;
  firstName: string;
  lastName: string;
  image: string | null;
} | null> {
  const row = await db.query.userOrganizationPosition.findFirst({
    where: (t, { eq, and }) =>
      and(eq(t.position, "department_head"), eq(t.department, dept)),
    with: {
      user: {
        columns: { id: true, firstName: true, lastName: true, image: true },
      },
    },
  });
  return row?.user ?? null;
}

export const SYSTEM_USER_EMAIL = "cockpit-system-user@start-berlin.com";

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

// Legal-membership tenure statuses that drive an open action item. All three
// are part of the live-tenure unique index, so at most one such row exists per
// user — joining on them never multiplies the result/count rows.
const ACTION_ITEM_LM_STATUSES = [
  "application_pending",
  "membership_reconfirmation_pending",
  "active",
] as const;

// Correlated subquery: does this user have any linked auth account? Users that
// were invited but never signed in have no account row yet.
const hasLoggedInSubquery = db
  .select({ x: sql`1` })
  .from(account)
  .where(eq(account.userId, userTable.id));

// SQL mirror of `getOnboardingProgress(...) === "completed"`: master data
// (personal email, phone, birth date) is present, and — for the statuses that
// require it — the event-email preference has been chosen. These fields are
// only ever written through validated forms, so a non-null check matches the
// validated state in practice while remaining expressible in SQL (needed so
// the filter can paginate).
const onboardingCompletedSql = sql<boolean>`(
  ${userTable.personalEmail} IS NOT NULL AND ${userTable.personalEmail} <> ''
  AND ${userTable.phone} IS NOT NULL AND ${userTable.phone} <> ''
  AND ${userTable.birthDate} IS NOT NULL
  AND (
    ${userTable.status} NOT IN ('onboarding', 'member', 'supporting_alumni')
    OR ${userTable.eventEmailPreference} IS NOT NULL
  )
)`;

// SQL predicate for each action item, evaluated against the user row joined to
// its live legal-membership tenure (`legalMembership`, may be null). Onboarding
// gates the membership tasks: a member who hasn't signed in / finished
// onboarding is nudged to do that first, not to (re)confirm their membership.
function actionItemPredicate(type: ActionItemType): SQL {
  switch (type) {
    case "first_login":
      return notExists(hasLoggedInSubquery);
    case "complete_onboarding":
      return and(
        exists(hasLoggedInSubquery),
        not(onboardingCompletedSql),
      ) as SQL;
    case "submit_application":
      return and(
        onboardingCompletedSql,
        eq(legalMembership.status, "application_pending"),
      ) as SQL;
    case "reconfirm_membership":
      return and(
        onboardingCompletedSql,
        eq(legalMembership.status, "membership_reconfirmation_pending"),
      ) as SQL;
    case "set_up_mandate":
      return and(
        eq(legalMembership.status, "active"),
        // Mirror the truthy `!gocardlessMandateId` convention used for the
        // badge (and in membership-status.ts): treat NULL and "" alike.
        or(
          isNull(userTable.gocardlessMandateId),
          eq(userTable.gocardlessMandateId, ""),
        ),
      ) as SQL;
  }
}

export async function getAllUsersForAdmin({
  page = 1,
  search = "",
  status,
  department,
  batchNumber,
  legalMembershipState,
  actionItem,
  sortBy = "name",
}: {
  page?: number;
  search?: string;
  status?: UserStatus[];
  department?: Department[];
  batchNumber?: number[];
  legalMembershipState?: LegalMembershipState[];
  actionItem?: ActionItemType[];
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

  const actionItemClause = actionItem?.length
    ? or(...actionItem.map(actionItemPredicate))
    : undefined;

  const whereClause = and(
    searchClause,
    inArray(userTable.status, effectiveStatus),
    department?.length ? inArray(userTable.department, department) : undefined,
    batchNumber?.length
      ? inArray(userTable.batchNumber, batchNumber)
      : undefined,
    legalMembershipState?.length
      ? inArray(userTable.legalMembershipState, legalMembershipState)
      : undefined,
    actionItemClause,
    or(isNull(userTable.email), ne(userTable.email, SYSTEM_USER_EMAIL)),
  );

  const orderBy =
    sortBy === "joinDate"
      ? [
          asc(sql`${userTable.memberSinceDate} NULLS LAST`),
          asc(userTable.createdAt),
        ]
      : [asc(userTable.firstName), asc(userTable.lastName)];

  // Join the user's live legal-membership tenure (at most one row, see above).
  const legalMembershipJoin = and(
    eq(legalMembership.userId, userTable.id),
    inArray(legalMembership.status, [...ACTION_ITEM_LM_STATUSES]),
  );

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
      .leftJoin(legalMembership, legalMembershipJoin)
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(PEOPLE_PAGE_SIZE)
      .offset(offset),
    db
      .select({ total: count() })
      .from(userTable)
      .leftJoin(legalMembership, legalMembershipJoin)
      .where(whereClause),
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
      .innerJoin(userTable, eq(usersToGroups.userId, userTable.id))
      .where(
        or(isNull(userTable.email), ne(userTable.email, SYSTEM_USER_EMAIL)),
      )
      .groupBy(usersToGroups.groupId)
      .as("member_counts");

    const rows = await db
      .select({
        id: groupTable.id,
        name: groupTable.name,
        slug: groupTable.slug,
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
