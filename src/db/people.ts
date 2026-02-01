import { actionClient } from "@/lib/action-client";
import db from ".";
import type { Department, UserStatus } from "./schema/auth";

export interface PublicUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  department: Department | null;
  batchNumber: number;
  status: UserStatus;
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
