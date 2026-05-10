import { createGroupWorkflow } from "./create-group";
import { membershipAdmissionWorkflow } from "./membership-admission-workflow";
import { onboardNewUserWorkflow } from "./new-user-workflow";
import { handleSlackEvent } from "./slack-user-joined";
import { syncGoogleWorkspaceUserNameWorkflow } from "./sync-google-workspace-user-name";

export const inngestFunctions = [
  createGroupWorkflow,
  handleSlackEvent,
  onboardNewUserWorkflow,
  membershipAdmissionWorkflow,
  syncGoogleWorkspaceUserNameWorkflow,
];
