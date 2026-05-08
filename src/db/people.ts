import {
  getStructuredMembershipState,
  type StructuredMembershipState,
} from "@/lib/membership-status";
import { getOnboardingProgress } from "@/schema/onboarding-progress";
import db from ".";
import type { Department, UserStatus } from "./schema/auth";
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
  batchNumber: number;
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
  batchNumber: number;
  status: UserStatus;
  membershipState: StructuredMembershipState;
  profileOnboardingComplete: boolean;
  hasMembershipPayment: boolean;
  paidThroughAt: Date | null;
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

const ACTIVE_TENURE_STATUSES = [
  "admission_pending",
  "application_pending",
  "processing",
  "active",
] as const;

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
      status: true,
      department: true,
      legalMembershipState: true,
    },
    with: {
      batch: true,
      membershipPayment: true,
      legalMemberships: {
        columns: { status: true },
      },
    },
  });

  return allUsers.map((user): PublicUser => {
    if (!user.batch) {
      throw new Error("User has no batch");
    }

    const hasActiveTenure = user.legalMemberships.some((lm) =>
      (ACTIVE_TENURE_STATUSES as readonly string[]).includes(lm.status),
    );

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      department: user.department ?? null,
      batchNumber: user.batch.number,
      status: user.status,
      profileOnboardingComplete: getOnboardingProgress(user) === "completed",
      hasMembershipPayment: !!user.membershipPayment,
      hasActiveTenure,
    };
  });
}

export async function getUserById(id: string): Promise<UserDetail | null> {
  const user = await db.query.user.findFirst({
    where: (users, { eq }) => eq(users.id, id),
    with: {
      batch: true,
      usersToGroups: {
        with: {
          group: true,
        },
      },
      membershipPayment: true,
      organizationPositions: true,
      accessGrants: true,
    },
  });

  if (!user) {
    return null;
  }

  if (!user.batch) {
    throw new Error("User has no batch");
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
    batchNumber: user.batch.number,
    status: user.status,
    membershipState: getStructuredMembershipState(user, user.membershipPayment),
    profileOnboardingComplete: getOnboardingProgress(user) === "completed",
    hasMembershipPayment: !!user.membershipPayment,
    paidThroughAt: user.membershipPayment?.paidThroughAt ?? null,
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
