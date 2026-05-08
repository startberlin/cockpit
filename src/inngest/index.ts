import { createGroupWorkflow } from "./create-group";
import { membershipAdmissionWorkflow } from "./membership-admission-workflow";
import { onboardNewUserWorkflow } from "./new-user-workflow";
import { handleSlackEvent } from "./slack-user-joined";

export const inngestFunctions = [
  createGroupWorkflow,
  handleSlackEvent,
  onboardNewUserWorkflow,
  membershipAdmissionWorkflow,
];
