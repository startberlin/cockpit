import { actionClient } from "@/lib/action-client";
import db from ".";
import type { Department, Role, UserStatus } from "./schema/auth";

export interface PublicUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  department: Department | null;
  batchNumber: number;
  status: UserStatus;
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
  roles: Role[];
  createdAt: Date;
  groups: Array<{
    id: string;
    name: string;
    role: string;
  }>;
}

export const getAllUserPublicData = actionClient.action(
  async (): Promise<PublicUser[]> => {
    const allUsers = await db.query.user.findMany({
      columns: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
        department: true,
      },
      with: {
        batch: true,
      },
    });

    return allUsers.map((user): PublicUser => {
      if (!user.batch) {
        throw new Error("User has no batch");
      }

      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        department: user.department ?? null,
        batchNumber: user.batch.number,
        status: user.status,
      };
    });
  },
);

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
    roles: user.roles,
    createdAt: user.createdAt,
    groups: user.usersToGroups.map((utg) => ({
      id: utg.group.id,
      name: utg.group.name,
      role: utg.role,
    })),
  };
}
