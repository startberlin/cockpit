import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { actionClient } from "@/lib/action-client";
import { isOnboardedUser } from "../schema/onboarding-progress";
import db from ".";
import { type UserStatus, user } from "./schema/auth";
import { batch } from "./schema/batch";
import { department } from "./schema/department";

export interface PublicUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  image: string | null;
  departmentId: string | null;
  batchNumber: number;
  status: UserStatus;
}

export interface PublicUserWithDetails {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  image: string | null;
  department: string | null;
  departmentId: string | null;
  batch: number;
  joinedDate: Date | string;
  leadFirstName: string | null;
  leadLastName: string | null;
  leadEmail: string | null;
  status: UserStatus;
}

export const getAllUsersWithDetails = actionClient.action(
  async (): Promise<PublicUserWithDetails[]> => {
    const allUsers = await db.query.user.findMany({
      columns: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        image: true,
        batchNumber: true,
        status: true,
        street: true,
        city: true,
        state: true,
        zip: true,
        country: true,
        phone: true,
      },
      with: {
        batch: true,
        department: {
          with: {
            leadMember: true,
          },
        },
      },
    });

    return allUsers
      .filter((user) => isOnboardedUser(user))
      .map((user): PublicUserWithDetails => {
        if (!user.batch) {
          throw new Error("User has no batch");
        }

        return {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          image: user.image,
          department: user.department?.name ?? null,
          departmentId: user.department?.id ?? null,
          batch: user.batch.number,
          joinedDate: user.batch.startDate,
          leadFirstName: user.department?.leadMember?.firstName ?? null,
          leadLastName: user.department?.leadMember?.lastName ?? null,
          leadEmail: user.department?.leadMember?.email ?? null,
          status: user.status,
        };
      });
  },
);

export const getAllUsers = actionClient.action(
  async (): Promise<PublicUser[]> => {
    const departmentLead = alias(user, "department_lead");

    const allUsers = await db
      .select()
      .from(user)
      .leftJoin(department, eq(user.departmentId, department.id))
      .leftJoin(departmentLead, eq(department.leadMemberId, departmentLead.id))
      .leftJoin(batch, eq(user.batchNumber, batch.number));

    const onboardedUsers = allUsers
      .filter(({ user }) => isOnboardedUser(user))
      .map(({ user }) => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        image: user.image,
        departmentId: user.departmentId,
        batchNumber: user.batchNumber,
        status: user.status,
      }));

    return onboardedUsers;
  },
);
