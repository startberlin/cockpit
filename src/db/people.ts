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
import type {
  AccessGrant,
  AuthorityScope,
  OrganizationPosition,
} from "./schema/authority";
import { LIVE_TENURE_STATUSES } from "./schema/legal-membership";

export interface PublicUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  department: Department | null;
  batchNumber: number | null;
  status: UserStatus;
  profileOnboardingComplete?: boolean;
  hasMembershipPayment?: boolean;
  hasActiveTenure?: boolean;
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
    id: string;
    position: OrganizationPosition;
    scope: AuthorityScope;
    department: Department | null;
  }>;
  accessGrants: Array<{
    id: string;
    grant: AccessGrant;
    scope: AuthorityScope;
    department: Department | null;
  }>;
  createdAt: Date;
  groups: Array<{
    id: string;
    name: string;
    role: string;
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

export async function getAllUserPublicData(): Promise<PublicUser[]> {
  const allUsers = await db.query.user.findMany({
    columns: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      emailVerified: true,
      image: true,
      createdAt: true,
      updatedAt: true,
      street: true,
      state: true,
      city: true,
      zip: true,
      country: true,
      personalEmail: true,
      batchNumber: true,
      phone: true,
      birthDate: true,
      status: true,
      department: true,
      legalMembershipState: true,
      gocardlessMandateId: true,
    },
    with: {
      batch: true,
      legalMemberships: {
        columns: { status: true },
      },
    },
  });

  return allUsers.map((user): PublicUser => {
    const hasActiveTenure = user.legalMemberships.some((lm) =>
      (LIVE_TENURE_STATUSES as readonly string[]).includes(lm.status),
    );

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      department: user.department ?? null,
      batchNumber: user.batch?.number ?? null,
      status: user.status,
      profileOnboardingComplete: getOnboardingProgress(user) === "completed",
      hasMembershipPayment: !!user.gocardlessMandateId,
      hasActiveTenure,
    };
  });
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
  createdAt: Date;
}

export interface UserGroupMembership {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export interface UserAuthorityData {
  id: string;
  organizationPositions: Array<{
    id: string;
    position: OrganizationPosition;
    scope: AuthorityScope;
    department: Department | null;
  }>;
  accessGrants: Array<{
    id: string;
    grant: AccessGrant;
    scope: AuthorityScope;
    department: Department | null;
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
      role: row.role,
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
          columns: { id: true, position: true, scope: true, department: true },
        },
        accessGrants: {
          columns: { id: true, grant: true, scope: true, department: true },
        },
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      organizationPositions: user.organizationPositions.map((p) => ({
        id: p.id,
        position: p.position,
        scope: p.scope,
        department: p.department,
      })),
      accessGrants: user.accessGrants.map((g) => ({
        id: g.id,
        grant: g.grant,
        scope: g.scope,
        department: g.department,
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
      id: assignment.id,
      position: assignment.position,
      scope: assignment.scope,
      department: assignment.department,
    })),
    accessGrants: user.accessGrants.map((assignment) => ({
      id: assignment.id,
      grant: assignment.grant,
      scope: assignment.scope,
      department: assignment.department,
    })),
    createdAt: user.createdAt,
    groups: user.usersToGroups.map((utg) => ({
      id: utg.group.id,
      name: utg.group.name,
      role: utg.role,
    })),
  };
}
