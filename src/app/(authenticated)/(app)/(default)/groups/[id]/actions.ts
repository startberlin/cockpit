"use server";

import { inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import db from "@/db";
import {
  addUserToGroup,
  getAllGroupMembersForExport,
  removeUserFromGroup,
  searchUsersNotInGroup,
} from "@/db/groups";
import type { PublicUser } from "@/db/people";
import { user } from "@/db/schema/auth";
import { getCurrentUser } from "@/db/user";
import { writeAuditLog } from "@/lib/audit-log";
import { triggerGoogleSync } from "@/lib/groups/google-sync";
import {
  getMembersOfSystemGroup,
  isSystemGroupSlug,
} from "@/lib/groups/system-groups";
import { can } from "@/lib/permissions/server";

function buildCsv(
  members: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    personalEmail?: string | null;
    eventEmailPreference?: "personal_email" | "start_email" | "custom" | null;
    eventInviteEmail?: string | null;
  }[],
): string {
  const rows = [
    "name,email",
    ...members.map((m) => {
      const name = `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim();
      const email =
        m.eventEmailPreference === "custom" && m.eventInviteEmail
          ? m.eventInviteEmail
          : m.eventEmailPreference === "personal_email" && m.personalEmail
            ? m.personalEmail
            : m.email;
      return `"${name}",${email ?? ""}`;
    }),
  ];
  return rows.join("\n");
}

export async function exportGroupCsvAction(groupId: string): Promise<string> {
  const currentUser = await getCurrentUser();
  if (!currentUser || !(await can("group.export", { id: groupId }))) {
    throw new Error("You are not authorized to export this group.");
  }

  const batches = await db.query.batch.findMany({ columns: { number: true } });

  if (isSystemGroupSlug(groupId, batches)) {
    const [minimalUsers, positions] = await Promise.all([
      db.query.user.findMany({
        columns: {
          id: true,
          status: true,
          department: true,
          batchNumber: true,
        },
      }),
      db.query.userOrganizationPosition.findMany({
        columns: {
          userId: true,
          position: true,
          scope: true,
          department: true,
        },
      }),
    ]);

    const memberIds = getMembersOfSystemGroup(
      groupId,
      minimalUsers,
      positions,
    ).map((m) => m.id);
    if (memberIds.length === 0) return "name,email";

    const members = await db
      .select({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        personalEmail: user.personalEmail,
        eventEmailPreference: user.eventEmailPreference,
        eventInviteEmail: user.eventInviteEmail,
      })
      .from(user)
      .where(inArray(user.id, memberIds))
      .orderBy(user.firstName, user.lastName);

    return buildCsv(members);
  }

  return buildCsv(await getAllGroupMembersForExport(groupId));
}

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
}
