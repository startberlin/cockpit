import { gocardlessEventsCleanupCron } from "./gocardless-events-cleanup";
import { membershipAdmissionWorkflow } from "./membership-admission-workflow";
import { membershipPaymentProposalsCron } from "./membership-payment-proposals";
import { membershipReconfirmationWorkflow } from "./membership-reconfirmation-workflow";
import { onboardNewUserWorkflow } from "./new-user-workflow";
import {
  positionAssignmentCreatedNotification,
  positionAssignmentDeletedNotification,
} from "./position-assignment-notifications";
import { reconcileGroupMembershipWorkflow } from "./reconcile-group-membership";
import { reconcileUserGroupMembershipWorkflow } from "./reconcile-user-group-membership";
import { syncGoogleWorkspaceUserNameWorkflow } from "./sync-google-workspace-user-name";
import { syncGroupsCron } from "./sync-groups-cron";

export const inngestFunctions = [
  gocardlessEventsCleanupCron,
  syncGroupsCron,
  membershipAdmissionWorkflow,
  membershipPaymentProposalsCron,
  membershipReconfirmationWorkflow,
  onboardNewUserWorkflow,
  positionAssignmentCreatedNotification,
  positionAssignmentDeletedNotification,
  reconcileGroupMembershipWorkflow,
  reconcileUserGroupMembershipWorkflow,
  syncGoogleWorkspaceUserNameWorkflow,
];
