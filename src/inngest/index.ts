import { createGroupWorkflow } from "./create-group";
import { membershipAdmissionWorkflow } from "./membership-admission-workflow";
import { membershipPaymentProposalsCron } from "./membership-payment-proposals";
import { membershipReconfirmationWorkflow } from "./membership-reconfirmation-workflow";
import { onboardNewUserWorkflow } from "./new-user-workflow";
import { handleSlackEvent } from "./slack-user-joined";
import { syncGoogleWorkspaceUserNameWorkflow } from "./sync-google-workspace-user-name";

export const inngestFunctions = [
  createGroupWorkflow,
  handleSlackEvent,
  membershipAdmissionWorkflow,
  membershipPaymentProposalsCron,
  membershipReconfirmationWorkflow,
  onboardNewUserWorkflow,
  syncGoogleWorkspaceUserNameWorkflow,
];
