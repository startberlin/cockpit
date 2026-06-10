"use server";

import { and, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import db from "@/db";
import {
  addUsersToGroup,
  addUserToGroup,
  getAllGroupMembersForExport,
  getAllGroupMembersForPhoneExport,
  listAllUsersNotInGroup,
  removeUserFromGroup,
  searchUsersNotInGroup,
  updateUserRoleInGroup,
} from "@/db/groups";
import type { PublicUser } from "@/db/people";
import { SYSTEM_USER_EMAIL } from "@/db/people";
import { user } from "@/db/schema/auth";
import { usersToGroups } from "@/db/schema/group";
import { getCurrentUser } from "@/db/user";
import { writeAuditLog } from "@/lib/audit-log";
import {
  getMembersOfSystemGroup,
  isSystemGroupSlug,
} from "@/lib/groups/system-groups";
import { events, inngest } from "@/lib/inngest";
import { can } from "@/lib/permissions/server";
import { buildSubjectMetadata, track } from "@/lib/posthog-server";

const FORMULA_CHARS = new Set(["=", "+", "-", "@", "\t", "\n"]);

function csvField(value: string): string {
  const safe = FORMULA_CHARS.has(value[0]) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

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
      return `${csvField(name)},${csvField(email ?? "")}`;
    }),
  ];
  return rows.join("\n");
}

export async function exportGroupCsvAction(groupId: string): Promise<string> {
  const currentUser = await getCurrentUser();
  if (!currentUser || !(await can("group.export", { id: groupId }))) {
    throw new Error("You are not authorized to export this group.");
  }

  if (isSystemGroupSlug(groupId, []) || groupId.startsWith("batch-")) {
    const [userRows, positions] = await Promise.all([
      db.query.user.findMany({
        columns: {
          id: true,
          status: true,
          department: true,
          batchNumber: true,
        },
        with: { accessGrants: { columns: { grant: true } } },
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

    const minimalUsers = userRows.map((u) => ({
      id: u.id,
      status: u.status,
      department: u.department,
      batchNumber: u.batchNumber,
      grants: u.accessGrants.map((g) => g.grant),
    }));

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

function buildPhoneCsv(
  members: {
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
  }[],
): string {
  const rows = [
    "first name,last name,phone",
    ...members.map(
      (m) =>
        `${csvField(m.firstName ?? "")},${csvField(m.lastName ?? "")},${csvField(m.phone ?? "")}`,
    ),
  ];
  return rows.join("\n");
}

export async function exportGroupPhoneCsvAction(
  groupId: string,
): Promise<string> {
  const currentUser = await getCurrentUser();
  if (!currentUser || !(await can("group.export", { id: groupId }))) {
    throw new Error("You are not authorized to export this group.");
  }

  if (isSystemGroupSlug(groupId, []) || groupId.startsWith("batch-")) {
    const [userRows, positions] = await Promise.all([
      db.query.user.findMany({
        columns: {
          id: true,
          status: true,
          department: true,
          batchNumber: true,
        },
        with: { accessGrants: { columns: { grant: true } } },
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

    const minimalUsers = userRows.map((u) => ({
      id: u.id,
      status: u.status,
      department: u.department,
      batchNumber: u.batchNumber,
      grants: u.accessGrants.map((g) => g.grant),
    }));

    const memberIds = getMembersOfSystemGroup(
      groupId,
      minimalUsers,
      positions,
    ).map((m) => m.id);
    if (memberIds.length === 0) return "first name,last name,phone";

    const members = await db
      .select({
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
      })
      .from(user)
      .where(inArray(user.id, memberIds))
      .orderBy(user.firstName, user.lastName);

    return buildPhoneCsv(members);
  }

  return buildPhoneCsv(await getAllGroupMembersForPhoneExport(groupId));
}

export async function exportMultipleGroupsPhoneCsvAction(
  groupIds: string[],
): Promise<string> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    throw new Error("You are not authorized to export groups.");
  }
  if (groupIds.length === 0) return "first name,last name,phone";

  const systemIds = groupIds.filter(
    (id) => isSystemGroupSlug(id, []) || id.startsWith("batch-"),
  );
  const manualIds = groupIds.filter(
    (id) => !isSystemGroupSlug(id, []) && !id.startsWith("batch-"),
  );

  const permissionChecks = [
    ...(systemIds.length > 0 ? [can("group.export", { isMember: false })] : []),
    ...manualIds.map((id) => can("group.export", { id })),
  ];
  const results = await Promise.all(permissionChecks);
  if (results.some((ok) => !ok)) {
    throw new Error(
      "You are not authorized to export one or more of the selected groups.",
    );
  }

  const memberIdSet = new Set<string>();

  if (systemIds.length > 0) {
    const [minimalUserRows, positions] = await Promise.all([
      db.query.user.findMany({
        columns: {
          id: true,
          status: true,
          department: true,
          batchNumber: true,
        },
        with: { accessGrants: { columns: { grant: true } } },
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
    const minimalUsers = minimalUserRows.map((u) => ({
      id: u.id,
      status: u.status,
      department: u.department,
      batchNumber: u.batchNumber,
      grants: u.accessGrants.map((g) => g.grant),
    }));
    for (const id of systemIds) {
      for (const m of getMembersOfSystemGroup(id, minimalUsers, positions)) {
        memberIdSet.add(m.id);
      }
    }
  }

  if (manualIds.length > 0) {
    const rows = await db
      .select({ userId: usersToGroups.userId })
      .from(usersToGroups)
      .innerJoin(user, eq(usersToGroups.userId, user.id))
      .where(
        and(
          inArray(usersToGroups.groupId, manualIds),
          or(isNull(user.email), ne(user.email, SYSTEM_USER_EMAIL)),
        ),
      );
    for (const r of rows) memberIdSet.add(r.userId);
  }

  if (memberIdSet.size === 0) return "first name,last name,phone";

  const members = await db
    .select({
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
    })
    .from(user)
    .where(inArray(user.id, Array.from(memberIdSet)))
    .orderBy(user.firstName, user.lastName);

  return buildPhoneCsv(members);
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
  revalidatePath(`/groups/${groupId}`);
  try {
    await inngest.send({
      name: events.groupMemberAdded.name,
      data: { groupId, userId },
    });
  } catch (err) {
    console.error(
      `[add-user-to-group] Failed to send groupMemberAdded event`,
      err,
    );
  }

  await writeAuditLog({
    category: "group",
    eventType: "group.member_added",
    actor: { id: currentUser.id, name: currentUser.name },
    metadata: { groupId, userId },
  });

  after(async () => {
    const targetUser = await db.query.user.findFirst({
      where: eq(user.id, userId),
    });
    if (targetUser) {
      track({
        distinctId: targetUser.id,
        event: "group_member_added",
        properties: {
          actor_id: currentUser.id,
          group_id: groupId,
          ...buildSubjectMetadata(targetUser),
        },
      });
    }
  });
}

export async function removeUserFromGroupAction(
  userId: string,
  groupId: string,
): Promise<void> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    throw new Error("You are not authorized to manage group members.");
  }

  const targetMembership = await db
    .select({ role: usersToGroups.role })
    .from(usersToGroups)
    .where(
      and(eq(usersToGroups.groupId, groupId), eq(usersToGroups.userId, userId)),
    )
    .limit(1);

  const targetIsManager = targetMembership[0]?.role === "manager";
  const requiredPermission = targetIsManager
    ? "group.managers.manage"
    : "group.members.manage";

  if (!(await can(requiredPermission, { id: groupId }))) {
    throw new Error("You are not authorized to remove this group member.");
  }

  await removeUserFromGroup(userId, groupId);
  revalidatePath(`/groups/${groupId}`);
  try {
    await inngest.send({
      name: events.groupMemberRemoved.name,
      data: { groupId, userId },
    });
  } catch (err) {
    console.error(
      `[remove-user-from-group] Failed to send groupMemberRemoved event`,
      err,
    );
  }

  await writeAuditLog({
    category: "group",
    eventType: "group.member_removed",
    actor: { id: currentUser.id, name: currentUser.name },
    metadata: { groupId, userId },
  });

  after(async () => {
    const targetUser = await db.query.user.findFirst({
      where: eq(user.id, userId),
    });
    if (targetUser) {
      track({
        distinctId: targetUser.id,
        event: "group_member_removed",
        properties: {
          actor_id: currentUser.id,
          group_id: groupId,
          ...buildSubjectMetadata(targetUser),
        },
      });
    }
  });
}

export async function promoteToManagerAction(
  userId: string,
  groupId: string,
): Promise<void> {
  const currentUser = await getCurrentUser();
  if (!currentUser || !(await can("group.members.manage", { id: groupId }))) {
    throw new Error("You are not authorized to manage group members.");
  }
  await updateUserRoleInGroup(userId, groupId, "manager");
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/admin/groups/${groupId}`);
  await writeAuditLog({
    category: "group",
    eventType: "group.member_promoted_to_manager",
    actor: { id: currentUser.id, name: currentUser.name },
    metadata: { groupId, userId },
  });
}

export async function demoteFromManagerAction(
  userId: string,
  groupId: string,
): Promise<void> {
  const currentUser = await getCurrentUser();
  if (!currentUser || !(await can("group.managers.manage", { id: groupId }))) {
    throw new Error("You are not authorized to manage group managers.");
  }
  await updateUserRoleInGroup(userId, groupId, "member");
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/admin/groups/${groupId}`);
  await writeAuditLog({
    category: "group",
    eventType: "group.member_demoted_from_manager",
    actor: { id: currentUser.id, name: currentUser.name },
    metadata: { groupId, userId },
  });
}

export async function listUsersNotInGroupAction(
  groupId: string,
): Promise<PublicUser[]> {
  const currentUser = await getCurrentUser();
  if (!currentUser || !(await can("group.members.manage", { id: groupId }))) {
    throw new Error("You are not authorized to manage group members.");
  }
  return listAllUsersNotInGroup(groupId) as Promise<PublicUser[]>;
}

export async function addUsersToGroupAction(
  userIds: string[],
  groupId: string,
): Promise<void> {
  const currentUser = await getCurrentUser();
  if (!currentUser || !(await can("group.members.manage", { id: groupId }))) {
    throw new Error("You are not authorized to manage group members.");
  }
  if (userIds.length === 0) return;

  await addUsersToGroup({ groupId, userIds });
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/admin/groups/${groupId}`);

  try {
    await Promise.all(
      userIds.map((userId) =>
        inngest.send({
          name: events.groupMemberAdded.name,
          data: { groupId, userId },
        }),
      ),
    );
  } catch (err) {
    console.error(
      "[add-users-to-group] Failed to send groupMemberAdded events",
      err,
    );
  }

  await writeAuditLog({
    category: "group",
    eventType: "group.member_added",
    actor: { id: currentUser.id, name: currentUser.name },
    metadata: { groupId, userIds, count: userIds.length },
  });
}

export async function exportMultipleGroupsCsvAction(
  groupIds: string[],
): Promise<string> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    throw new Error("You are not authorized to export groups.");
  }
  if (groupIds.length === 0) return "name,email";

  const systemIds = groupIds.filter(
    (id) => isSystemGroupSlug(id, []) || id.startsWith("batch-"),
  );
  const manualIds = groupIds.filter(
    (id) => !isSystemGroupSlug(id, []) && !id.startsWith("batch-"),
  );

  const permissionChecks = [
    ...(systemIds.length > 0 ? [can("group.export", { isMember: false })] : []),
    ...manualIds.map((id) => can("group.export", { id })),
  ];
  const results = await Promise.all(permissionChecks);
  if (results.some((ok) => !ok)) {
    throw new Error(
      "You are not authorized to export one or more of the selected groups.",
    );
  }

  const memberIdSet = new Set<string>();

  if (systemIds.length > 0) {
    const [minimalUserRows, positions] = await Promise.all([
      db.query.user.findMany({
        columns: {
          id: true,
          status: true,
          department: true,
          batchNumber: true,
        },
        with: { accessGrants: { columns: { grant: true } } },
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
    const minimalUsers = minimalUserRows.map((u) => ({
      id: u.id,
      status: u.status,
      department: u.department,
      batchNumber: u.batchNumber,
      grants: u.accessGrants.map((g) => g.grant),
    }));
    for (const id of systemIds) {
      for (const m of getMembersOfSystemGroup(id, minimalUsers, positions)) {
        memberIdSet.add(m.id);
      }
    }
  }

  if (manualIds.length > 0) {
    const rows = await db
      .select({ userId: usersToGroups.userId })
      .from(usersToGroups)
      .innerJoin(user, eq(usersToGroups.userId, user.id))
      .where(
        and(
          inArray(usersToGroups.groupId, manualIds),
          or(isNull(user.email), ne(user.email, SYSTEM_USER_EMAIL)),
        ),
      );
    for (const r of rows) memberIdSet.add(r.userId);
  }

  if (memberIdSet.size === 0) return "name,email";

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
    .where(inArray(user.id, Array.from(memberIdSet)))
    .orderBy(user.firstName, user.lastName);

  return buildCsv(members);
}
