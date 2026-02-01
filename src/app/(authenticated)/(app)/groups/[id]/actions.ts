"use server";

import { revalidatePath } from "next/cache";
import {
  addUserToGroupRaw,
  removeUserFromGroupRaw,
  searchUsersNotInGroupRaw,
  updateUserGroupRoleRaw,
} from "@/db/groups";
import type { PublicUser } from "@/db/people";

export async function searchUsersNotInGroupAction(
  groupId: string,
  query?: string,
): Promise<PublicUser[]> {
  return await searchUsersNotInGroupRaw(groupId, query);
}

export async function addUserToGroupAction(
  userId: string,
  groupId: string,
  role: "admin" | "member" = "member",
): Promise<void> {
  await addUserToGroupRaw(userId, groupId, role);
  revalidatePath(`/groups/${groupId}`);
}

export async function removeUserFromGroupAction(
  userId: string,
  groupId: string,
): Promise<void> {
  await removeUserFromGroupRaw(userId, groupId);
  revalidatePath(`/groups/${groupId}`);
}

export async function updateUserGroupRoleAction(
  userId: string,
  groupId: string,
  role: "admin" | "member",
): Promise<void> {
  await updateUserGroupRoleRaw(userId, groupId, role);
  revalidatePath(`/groups/${groupId}`);
}
