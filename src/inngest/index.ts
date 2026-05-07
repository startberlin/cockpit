import { createGroupWorkflow } from "./create-group";
import { membershipLifecycleWorkflow } from "./membership-lifecycle-workflow";
import { onboardNewUserWorkflow } from "./new-user-workflow";
import { handleSlackEvent } from "./slack-user-joined";

export const inngestFunctions = [
  createGroupWorkflow,
  handleSlackEvent,
  membershipLifecycleWorkflow,
  onboardNewUserWorkflow,
];
