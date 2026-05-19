import { count, ilike, or, sql } from "drizzle-orm";
import { cache } from "react";
import {
  getStructuredMembershipState,
  type StructuredMembershipState,
} from "@/lib/membership-status";
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

export interface PublicUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  department: Department | null;
  batchNumber: number | null;
  status: UserStatus;
  isEligibleForMembershipProposal?: boolean;
}

export interface UserDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  personalEmail: string;
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

const PEOPLE_PAGE_SIZE = 100;

export interface PaginatedUsers {
  users: PublicUser[];
  total: number;
  pageCount: number;
}

export async function getAllUserPublicData({
  page = 1,
  search = "",
}: {
  page?: number;
  search?: string;
} = {}): Promise<PaginatedUsers> {
  const offset = (page - 1) * PEOPLE_PAGE_SIZE;
  const whereClause = search
    ? or(
        ilike(userTable.firstName, `%${search}%`),
        ilike(userTable.lastName, `%${search}%`),
        ilike(
          sql`${userTable.firstName} || ' ' || ${userTable.lastName}`,
          `%${search}%`,
        ),
      )
    : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: userTable.id,
        firstName: userTable.firstName,
        lastName: userTable.lastName,
        email: userTable.email,
        department: userTable.department,
        batchNumber: sql<number | null>`${userTable.batchNumber}`,
        status: userTable.status,
      })
      .from(userTable)
      .where(whereClause)
      .orderBy(userTable.firstName, userTable.lastName)
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
      department: u.department ?? null,
      batchNumber: u.batchNumber ?? null,
      status: u.status,
    })),
    pageCount: Math.ceil(total / PEOPLE_PAGE_SIZE),
    total,
  };
}

export interface UserDetails {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  personalEmail: string;
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
  createdAt: Date;
}

export interface UserGroupMembership {
  id: string;
  name: string;
  slug: string;
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
