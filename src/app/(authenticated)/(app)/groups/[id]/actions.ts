"use server";

import { revalidatePath } from "next/cache";
import {
  addUserToGroup,
  pinGroupMember,
  removeUserFromGroup,
  searchUsersNotInGroup,
} from "@/db/groups";
import type { PublicUser } from "@/db/people";
import { getCurrentUser } from "@/db/user";
import { triggerGoogleSync } from "@/lib/groups/google-sync";
import { can } from "@/lib/permissions/server";

export async function searchUsersNotInGroupAction(
  groupId: string,
  query?: string,
): Promise<PublicUser[]> {
  const currentUser = await getCurrentUser();
  if (!currentUser || !(await can("groups.manage_members", { id: groupId }))) {
    throw new Error("You are not authorized to manage group members.");
  }

  return await searchUsersNotInGroup(groupId, query);
}

export async function addUserToGroupAction(
  userId: string,
  groupId: string,
): Promise<void> {
  const currentUser = await getCurrentUser();
  if (!currentUser || !(await can("groups.manage_members", { id: groupId }))) {
    throw new Error("You are not authorized to manage group members.");
  }

  await addUserToGroup(userId, groupId);
  await triggerGoogleSync(groupId);
  revalidatePath(`/groups/${groupId}`);
}

export async function removeUserFromGroupAction(
  userId: string,
  groupId: string,
): Promise<void> {
  const currentUser = await getCurrentUser();
  if (!currentUser || !(await can("groups.manage_members", { id: groupId }))) {
    throw new Error("You are not authorized to manage group members.");
  }

  await removeUserFromGroup(userId, groupId);
  await triggerGoogleSync(groupId);
  revalidatePath(`/groups/${groupId}`);
}

export async function pinGroupMemberAction(
  userId: string,
  groupId: string,
): Promise<void> {
  const currentUser = await getCurrentUser();
  if (!currentUser || !(await can("groups.manage_members", { id: groupId }))) {
    throw new Error("You are not authorized to manage group members.");
  }

  await pinGroupMember(userId, groupId);
  revalidatePath(`/groups/${groupId}`);
}
