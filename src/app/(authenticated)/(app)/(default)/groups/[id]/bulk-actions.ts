"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addUsersToGroup, findUsersNotInGroupByCriteria } from "@/db/groups";
import { actionClient } from "@/lib/action-client";
import { normalizedGroupCriteriaSchema } from "@/lib/groups/criteria";
import { can } from "@/lib/permissions/server";

const searchByCriteriaSchema = normalizedGroupCriteriaSchema
  .omit({ match: true })
  .extend({
    match: normalizedGroupCriteriaSchema.shape.match.optional(),
  });

export const searchUsersByCriteriaAction = actionClient
  .inputSchema(searchByCriteriaSchema)
  .action(async ({ parsedInput }) => {
    if (!(await can("group.members.manage", { id: parsedInput.groupId }))) {
      throw new Error("You are not authorized to manage group members.");
    }

    const users = await findUsersNotInGroupByCriteria({
      ...parsedInput,
      match: parsedInput.match ?? "any",
    });

    return { users };
  });

const bulkAddUsersSchema = z.object({
  groupId: z.string().min(1),
  userIds: z.array(z.string()).min(1),
});

export const bulkAddUsersAction = actionClient
  .inputSchema(bulkAddUsersSchema)
  .action(async ({ parsedInput }) => {
    if (!(await can("group.members.manage", { id: parsedInput.groupId }))) {
      throw new Error("You are not authorized to manage group members.");
    }

    const { groupId, userIds } = parsedInput;
    await addUsersToGroup({ groupId, userIds });

    revalidatePath(`/groups/${groupId}`);
    return { added: userIds.length };
  });
