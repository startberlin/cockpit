import { sql } from "drizzle-orm";
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
import {
  LIVE_TENURE_STATUSES,
  legalMembership,
} from "./schema/legal-membership";

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
      firstName: true,
      lastName: true,
      email: true,
      personalEmail: true,
      phone: true,
      birthDate: true,
      batchNumber: true,
      status: true,
      department: true,
      gocardlessMandateId: true,
    },
    extras: {
      hasActiveTenure: sql<boolean>`EXISTS (
        SELECT 1 FROM ${legalMembership}
        WHERE ${legalMembership.userId} = ${userTable.id}
        AND ${legalMembership.status} = ANY(${sql.raw(`ARRAY[${LIVE_TENURE_STATUSES.map((s) => `'${s}'`).join(", ")}]::legal_membership_status[]`)})
      )`.as("has_active_tenure"),
    },
  });

  return allUsers.map(
    (u): PublicUser => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      department: u.department ?? null,
      batchNumber: u.batchNumber ?? null,
      status: u.status,
      profileOnboardingComplete: getOnboardingProgress(u) === "completed",
      hasMembershipPayment: !!u.gocardlessMandateId,
      hasActiveTenure: u.hasActiveTenure,
    }),
  );
}

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
