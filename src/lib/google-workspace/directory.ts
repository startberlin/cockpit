import "server-only";

import { type admin_directory_v1, Common, google } from "googleapis";
import { env } from "@/env";
import { createGoogleAuth } from "@/lib/google-auth";

const DIRECTORY_SCOPE = "https://www.googleapis.com/auth/admin.directory.user";
const GROUP_SCOPE = "https://www.googleapis.com/auth/admin.directory.group";

export interface WorkspaceUserCandidate {
  id: string;
  primaryEmail: string;
  name: string;
  givenName: string;
  familyName: string;
  suspended: boolean;
  creationTime: string | null;
}

function getDirectoryClient() {
  return google.admin({
    auth: createGoogleAuth(DIRECTORY_SCOPE),
    version: "directory_v1",
  });
}

function toCandidate(
  user: admin_directory_v1.Schema$User,
): WorkspaceUserCandidate | null {
  if (!user.id || !user.primaryEmail) {
    return null;
  }

  const givenName = user.name?.givenName ?? "";
  const familyName = user.name?.familyName ?? "";
  const fullName =
    user.name?.fullName ?? [givenName, familyName].filter(Boolean).join(" ");

  return {
    id: user.id,
    primaryEmail: user.primaryEmail,
    name: fullName || user.primaryEmail,
    givenName,
    familyName,
    suspended: !!user.suspended,
    creationTime: user.creationTime ?? null,
  };
}

export async function getWorkspaceUser(
  userKey: string,
): Promise<WorkspaceUserCandidate | null> {
  if (env.DISABLE_GOOGLE_WORKSPACE) {
    console.warn(
      `[google-workspace disabled] getWorkspaceUser(${userKey}) → null`,
    );
    return null;
  }

  const admin = getDirectoryClient();

  try {
    const res = await admin.users.get({
      projection: "basic",
      userKey,
    });

    return toCandidate(res.data);
  } catch (error) {
    if (error instanceof Common.GaxiosError && error.response?.status === 404) {
      return null;
    }

    throw error;
  }
}

export interface WorkspaceUsersPage {
  users: WorkspaceUserCandidate[];
  nextPageToken: string | null;
}

export async function fetchWorkspaceUsersPage({
  pageToken,
  query,
}: {
  pageToken?: string;
  query?: string;
} = {}): Promise<WorkspaceUsersPage> {
  if (env.DISABLE_GOOGLE_WORKSPACE) {
    console.warn("[google-workspace disabled] fetchWorkspaceUsersPage → []");
    return { users: [], nextPageToken: null };
  }

  const admin = getDirectoryClient();

  const res = await admin.users.list({
    customer: "my_customer",
    maxResults: 20,
    orderBy: "email",
    projection: "basic",
    pageToken,
    query: query || undefined,
  });

  const users = (res.data.users ?? [])
    .map(toCandidate)
    .filter((u): u is WorkspaceUserCandidate => u !== null);

  return {
    users,
    nextPageToken: res.data.nextPageToken ?? null,
  };
}

export async function findWorkspaceUserByEmail(email: string) {
  return await getWorkspaceUser(email.toLowerCase());
}

export async function updateWorkspaceUserName(
  userKey: string,
  {
    givenName,
    familyName,
  }: {
    givenName: string;
    familyName: string;
  },
) {
  if (env.DISABLE_GOOGLE_WORKSPACE) {
    console.warn(
      `[google-workspace disabled] updateWorkspaceUserName(${userKey}, ${givenName} ${familyName}) — skipped`,
    );
    return;
  }

  const admin = getDirectoryClient();

  const res = await admin.users.update({
    userKey,
    requestBody: {
      name: { givenName, familyName },
    },
  });

  if (!res.ok) {
    throw new Error(
      `Failed to update Workspace name for ${userKey}: ${res.statusText}`,
    );
  }
}

function getGroupClient() {
  return google.admin({
    auth: createGoogleAuth(GROUP_SCOPE),
    version: "directory_v1",
  });
}

export async function createGoogleGroup(
  emailPrefix: string,
  name: string,
): Promise<string | null> {
  const groupEmail = `${emailPrefix}@start-berlin.com`;

  if (env.DISABLE_GOOGLE_WORKSPACE) {
    console.warn(
      `[google-workspace disabled] would create Google Group ${groupEmail}`,
    );
    return null;
  }

  const admin = getGroupClient();

  try {
    await admin.groups.insert({
      requestBody: {
        email: groupEmail,
        name,
        description: `Email group for ${name}`,
      },
    });
  } catch (error) {
    if (error instanceof Common.GaxiosError && error.response?.status === 409) {
      // Already exists — reuse it.
    } else {
      throw error;
    }
  }

  return groupEmail;
}

export async function googleGroupExists(groupEmail: string): Promise<boolean> {
  if (env.DISABLE_GOOGLE_WORKSPACE) return false;

  const admin = getGroupClient();

  try {
    await admin.groups.get({ groupKey: groupEmail });
    return true;
  } catch (error) {
    if (error instanceof Common.GaxiosError && error.response?.status === 404) {
      return false;
    }
    throw error;
  }
}

export async function addGroupMember(
  groupEmail: string,
  userEmail: string,
): Promise<void> {
  if (env.DISABLE_GOOGLE_WORKSPACE) {
    console.warn(
      `[google-workspace disabled] addGroupMember(${groupEmail}, ${userEmail}) — skipped`,
    );
    return;
  }

  const admin = getGroupClient();

  try {
    await admin.members.insert({
      groupKey: groupEmail,
      requestBody: { email: userEmail, role: "MEMBER" },
    });
  } catch (error) {
    if (error instanceof Common.GaxiosError) {
      const status = error.response?.status;
      if (status === 409 || status === 400) {
        // 409: already a member. 400 with reason "duplicate" also surfaces here.
        return;
      }
    }
    throw error;
  }
}

export async function removeGroupMember(
  groupEmail: string,
  userEmail: string,
): Promise<void> {
  if (env.DISABLE_GOOGLE_WORKSPACE) {
    console.warn(
      `[google-workspace disabled] removeGroupMember(${groupEmail}, ${userEmail}) — skipped`,
    );
    return;
  }

  const admin = getGroupClient();

  try {
    await admin.members.delete({
      groupKey: groupEmail,
      memberKey: userEmail,
    });
  } catch (error) {
    if (error instanceof Common.GaxiosError && error.response?.status === 404) {
      return;
    }
    throw error;
  }
}

export async function listGroupMemberEmails(
  groupEmail: string,
): Promise<string[]> {
  if (env.DISABLE_GOOGLE_WORKSPACE) {
    console.warn(
      `[google-workspace disabled] listGroupMemberEmails(${groupEmail}) → []`,
    );
    return [];
  }

  const admin = getGroupClient();
  const emails: string[] = [];
  let pageToken: string | undefined;

  do {
    const res = await admin.members.list({
      groupKey: groupEmail,
      maxResults: 200,
      pageToken,
    });

    for (const member of res.data.members ?? []) {
      if (member.email) {
        emails.push(member.email.toLowerCase());
      }
    }

    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return emails;
}
