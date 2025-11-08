import { onboardNewUserWorkflow } from "./new-user-workflow";
import { handleSlackEvent } from "./slack-user-joined";
import { syncUserAccounts } from "./sync-user-accounts";

export const inngestFunctions = [
  handleSlackEvent,
  onboardNewUserWorkflow,
  syncUserAccounts,
];
