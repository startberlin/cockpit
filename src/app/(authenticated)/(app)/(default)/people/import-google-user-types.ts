import type { fetchWorkspaceUsersPageAction } from "./import-google-user-action";

export type WorkspaceCandidate = NonNullable<
  Awaited<ReturnType<typeof fetchWorkspaceUsersPageAction>>["data"]
>["users"][number];

export type WizardStep = "browse" | "profile" | "membership";
