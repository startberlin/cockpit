"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import db from "@/db";
import {
  addGroupCriteria,
  addUsersMatchingCriteria,
  getGroupCriteriaById,
  removeGroupCriteria,
} from "@/db/groups";
import { actionClient } from "@/lib/action-client";
import { addGroupCriteriaSchema } from "@/lib/groups/criteria";
import { can } from "@/lib/permissions/server";

export const addGroupCriteriaAction = actionClient
  .inputSchema(addGroupCriteriaSchema)
  .action(async ({ parsedInput, ctx: { user: currentUser } }) => {
    if (!(await can("groups.manage_members"))) {
      throw new Error("You are not authorized to manage group members.");
    }

    const { criteria, addedUsersCount } = await db.transaction(async (tx) => {
      const criteria = await addGroupCriteria(
        { ...parsedInput, createdBy: currentUser.id },
        tx,
      );
      const addedUsersCount = await addUsersMatchingCriteria(
        parsedInput.groupId,
        {
          department: parsedInput.department,
          status: parsedInput.status,
          batchNumber: parsedInput.batchNumber,
        },
        tx,
      );
      return { criteria, addedUsersCount };
    });

    revalidatePath(`/groups/${parsedInput.groupId}`);
    return { criteria, addedUsersCount };
  });

const removeGroupCriteriaInputSchema = z.object({
  criteriaId: z.string().min(1),
  groupId: z.string().min(1),
});

export const removeGroupCriteriaAction = actionClient
  .inputSchema(removeGroupCriteriaInputSchema)
  .action(async ({ parsedInput }) => {
    if (!(await can("groups.manage_members"))) {
      throw new Error("You are not authorized to manage group members.");
    }

    const criteria = await getGroupCriteriaById(parsedInput.criteriaId);
    if (!criteria) {
      throw new Error("Criteria not found.");
    }

    await removeGroupCriteria({ criteriaId: parsedInput.criteriaId });
    revalidatePath(`/groups/${parsedInput.groupId}`);
    return { success: true };
  });
