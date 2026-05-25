export type SyncGroupMembershipDeps = {
  listGroupMemberEmails: (groupEmail: string) => Promise<string[]>;
  addGroupMember: (groupEmail: string, userEmail: string) => Promise<void>;
  removeGroupMember: (groupEmail: string, userEmail: string) => Promise<void>;
  createGoogleGroup: (
    emailPrefix: string,
    name: string,
  ) => Promise<string | null>;
  getGroupName: (emailPrefix: string) => string;
};

/**
 * Ensures a single user is added to or removed from a Google Group.
 * Creates the group first if it doesn't exist (404 guard).
 */
export async function syncGroupMembership(
  groupEmail: string,
  shouldBeMember: boolean,
  userEmail: string,
  deps: SyncGroupMembershipDeps,
): Promise<void> {
  let currentMembers: string[];
  try {
    currentMembers = await deps.listGroupMemberEmails(groupEmail);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { response?: { status?: number } }).response?.status === 404
    ) {
      const emailPrefix = groupEmail.split("@")[0];
      await deps.createGoogleGroup(emailPrefix, deps.getGroupName(emailPrefix));
      currentMembers = [];
    } else {
      throw error;
    }
  }
  const normalizedUserEmail = userEmail.toLowerCase();
  const isCurrentMember = currentMembers.some(
    (m) => m.toLowerCase() === normalizedUserEmail,
  );
  if (shouldBeMember && !isCurrentMember) {
    await deps.addGroupMember(groupEmail, userEmail);
  } else if (!shouldBeMember && isCurrentMember) {
    await deps.removeGroupMember(groupEmail, userEmail);
  }
}
