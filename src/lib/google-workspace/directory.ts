import "server-only";

import { type admin_directory_v1, Common, google } from "googleapis";
import { createGoogleAuth } from "@/lib/google-auth";

const DIRECTORY_SCOPE = "https://www.googleapis.com/auth/admin.directory.user";

export interface WorkspaceUserCandidate {
  id: string;
  primaryEmail: string;
  name: string;
  givenName: string;
  familyName: string;
  suspended: boolean;
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
  };
}

export async function getWorkspaceUser(
  userKey: string,
): Promise<WorkspaceUserCandidate | null> {
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

export async function listAllWorkspaceUsers(): Promise<WorkspaceUserCandidate[]> {
  const admin = getDirectoryClient();
  const candidates: WorkspaceUserCandidate[] = [];
  let pageToken: string | undefined;

  do {
    const res = await admin.users.list({
      customer: "my_customer",
      maxResults: 500,
      orderBy: "email",
      projection: "basic",
      pageToken,
    });

    for (const user of res.data.users ?? []) {
      const candidate = toCandidate(user);
      if (candidate) candidates.push(candidate);
    }

    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return candidates;
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
