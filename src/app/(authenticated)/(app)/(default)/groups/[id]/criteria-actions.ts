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
import { triggerGoogleSync } from "@/lib/groups/google-sync";
import { reconcileGroupMembership } from "@/lib/groups/reconcile";
import { can } from "@/lib/permissions/server";

export const addGroupCriteriaAction = actionClient
  .inputSchema(addGroupCriteriaSchema)
  .action(async ({ parsedInput, ctx: { user: currentUser } }) => {
    if (!(await can("group.members.manage", { id: parsedInput.groupId }))) {
      throw new Error("You are not authorized to manage group members.");
    }

    const criteria = await db.transaction(async (tx) => {
      const newCriteria = await addGroupCriteria(
        { ...parsedInput, createdBy: currentUser.id },
        tx,
      );
      await addUsersMatchingCriteria(
        parsedInput.groupId,
        newCriteria.conditions,
        tx,
      );
      return newCriteria;
    });

    await reconcileGroupMembership(parsedInput.groupId);
    await triggerGoogleSync(parsedInput.groupId);

    revalidatePath(`/groups/${parsedInput.groupId}`);
    return { criteria };
  });

const removeGroupCriteriaInputSchema = z.object({
  criteriaId: z.string().min(1),
  groupId: z.string().min(1),
});

export const removeGroupCriteriaAction = actionClient
  .inputSchema(removeGroupCriteriaInputSchema)
  .action(async ({ parsedInput }) => {
    if (!(await can("group.members.manage", { id: parsedInput.groupId }))) {
      throw new Error("You are not authorized to manage group members.");
    }

    const criteria = await getGroupCriteriaById(parsedInput.criteriaId);
    if (!criteria || criteria.groupId !== parsedInput.groupId) {
      throw new Error("Criteria not found.");
    }

    await removeGroupCriteria({ criteriaId: parsedInput.criteriaId });
    await reconcileGroupMembership(parsedInput.groupId);
    await triggerGoogleSync(parsedInput.groupId);

    revalidatePath(`/groups/${parsedInput.groupId}`);
    return {};
  });
