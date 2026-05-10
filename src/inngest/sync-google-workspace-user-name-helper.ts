export interface LocalUserName {
  firstName: string;
  lastName: string;
}

export interface WorkspaceUserName {
  givenName: string;
  familyName: string;
}

export function getWorkspaceNameUpdate(
  localUser: LocalUserName,
  workspaceUser: WorkspaceUserName,
) {
  if (
    localUser.firstName === workspaceUser.givenName &&
    localUser.lastName === workspaceUser.familyName
  ) {
    return null;
  }

  return {
    givenName: localUser.firstName,
    familyName: localUser.lastName,
  };
}
