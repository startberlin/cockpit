import { createGroupWorkflow } from "./create-group";
import { onboardNewUserWorkflow } from "./new-user-workflow";
import { handleSlackEvent } from "./slack-user-joined";

export const inngestFunctions = [
  createGroupWorkflow,
  handleSlackEvent,
  onboardNewUserWorkflow,
];
