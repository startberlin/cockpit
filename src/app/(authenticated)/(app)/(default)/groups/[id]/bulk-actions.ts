"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addUsersToGroup, findUsersNotInGroupByCriteria } from "@/db/groups";
import { actionClient } from "@/lib/action-client";
import { writeAuditLog } from "@/lib/audit-log";
import { normalizedGroupCriteriaSchema } from "@/lib/groups/criteria";
import { can } from "@/lib/permissions/server";
import { getPostHogClient } from "@/lib/posthog-server";

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
  criteriaType: z.enum(["department", "status", "batch"]).optional(),
});

export const bulkAddUsersAction = actionClient
  .inputSchema(bulkAddUsersSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!(await can("group.members.manage", { id: parsedInput.groupId }))) {
      throw new Error("You are not authorized to manage group members.");
    }

    const { groupId, userIds, criteriaType } = parsedInput;
    await addUsersToGroup({ groupId, userIds });

    revalidatePath(`/groups/${groupId}`);

    await writeAuditLog({
      category: "group",
      eventType: "group.members_bulk_added",
      actor: { id: ctx.user.id, name: ctx.user.name },
      metadata: { groupId, count: userIds.length, userIds },
      description: `${userIds.length} member${userIds.length === 1 ? "" : "s"}`,
    });

    getPostHogClient()?.capture({
      distinctId: ctx.user.id,
      event: "group_bulk_members_added",
      properties: {
        criteria_type: criteriaType ?? null,
        member_count: userIds.length,
      },
    });

    return { added: userIds.length };
  });
