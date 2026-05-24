"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import db from "@/db";
import {
  addUserToGroup,
  pinGroupMember,
  removeUserFromGroup,
  searchUsersNotInGroup,
} from "@/db/groups";
import type { PublicUser } from "@/db/people";
import { user } from "@/db/schema/auth";
import { getCurrentUser } from "@/db/user";
import { writeAuditLog } from "@/lib/audit-log";
import { triggerGoogleSync } from "@/lib/groups/google-sync";
import { can } from "@/lib/permissions/server";
import { buildSubjectMetadata, getPostHogClient } from "@/lib/posthog-server";

export async function searchUsersNotInGroupAction(
  groupId: string,
  query?: string,
): Promise<PublicUser[]> {
  const currentUser = await getCurrentUser();
  if (!currentUser || !(await can("group.members.manage", { id: groupId }))) {
    throw new Error("You are not authorized to manage group members.");
  }

  return await searchUsersNotInGroup(groupId, query);
}

export async function addUserToGroupAction(
  userId: string,
  groupId: string,
): Promise<void> {
  const currentUser = await getCurrentUser();
  if (!currentUser || !(await can("group.members.manage", { id: groupId }))) {
    throw new Error("You are not authorized to manage group members.");
  }

  await addUserToGroup(userId, groupId);
  await triggerGoogleSync(groupId);
  revalidatePath(`/groups/${groupId}`);

  await writeAuditLog({
    category: "group",
    eventType: "group.member_added",
    actor: { id: currentUser.id, name: currentUser.name },
    metadata: { groupId, userId },
  });

  try {
    const targetUser = await db.query.user.findFirst({
      where: eq(user.id, userId),
    });
    if (targetUser) {
      getPostHogClient()?.capture({
        distinctId: targetUser.id,
        event: "group_member_added",
        properties: {
          actor_id: currentUser.id,
          group_id: groupId,
          ...buildSubjectMetadata(targetUser),
        },
      });
    }
  } catch (error) {
    console.error(
      "[analytics] Failed to capture group_member_added event",
      error,
    );
  }
}

export async function removeUserFromGroupAction(
  userId: string,
  groupId: string,
): Promise<void> {
  const currentUser = await getCurrentUser();
  if (!currentUser || !(await can("group.members.manage", { id: groupId }))) {
    throw new Error("You are not authorized to manage group members.");
  }

  await removeUserFromGroup(userId, groupId);
  await triggerGoogleSync(groupId);
  revalidatePath(`/groups/${groupId}`);

  await writeAuditLog({
    category: "group",
    eventType: "group.member_removed",
    actor: { id: currentUser.id, name: currentUser.name },
    metadata: { groupId, userId },
  });

  try {
    const targetUser = await db.query.user.findFirst({
      where: eq(user.id, userId),
    });
    if (targetUser) {
      getPostHogClient()?.capture({
        distinctId: targetUser.id,
        event: "group_member_removed",
        properties: {
          actor_id: currentUser.id,
          group_id: groupId,
          ...buildSubjectMetadata(targetUser),
        },
      });
    }
  } catch (error) {
    console.error(
      "[analytics] Failed to capture group_member_removed event",
      error,
    );
  }
}

export async function pinGroupMemberAction(
  userId: string,
  groupId: string,
): Promise<void> {
  const currentUser = await getCurrentUser();
  if (!currentUser || !(await can("group.members.manage", { id: groupId }))) {
    throw new Error("You are not authorized to manage group members.");
  }

  await pinGroupMember(userId, groupId);
  revalidatePath(`/groups/${groupId}`);

  try {
    const targetUser = await db.query.user.findFirst({
      where: eq(user.id, userId),
    });
    if (targetUser) {
      getPostHogClient()?.capture({
        distinctId: targetUser.id,
        event: "group_member_pinned",
        properties: {
          actor_id: currentUser.id,
          group_id: groupId,
          pinned: true,
          ...buildSubjectMetadata(targetUser),
        },
      });
    }
  } catch (error) {
    console.error(
      "[analytics] Failed to capture group_member_pinned event",
      error,
    );
  }
}
