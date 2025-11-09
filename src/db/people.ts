import { actionClient } from "@/lib/action-client";
import db from ".";
import type { UserStatus } from "./schema/auth";

export interface PublicUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string | null;
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
      },
      with: {
        batch: true,
        department: { columns: { id: true, name: true } },
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
        department: user.department?.name ?? null,
        batchNumber: user.batch.number,
        status: user.status,
      };
    });
  },
);
