import { gocardlessEventsCleanupCron } from "./gocardless-events-cleanup";
import { membershipAdmissionWorkflow } from "./membership-admission-workflow";
import { membershipCancellationWorkflow } from "./membership-cancellation-workflow";
import { membershipPaymentProposalsCron } from "./membership-payment-proposals";
import { membershipReconfirmationWorkflow } from "./membership-reconfirmation-workflow";
import { membershipTransitionWorkflow } from "./membership-transition-workflow";
import { onboardNewUserWorkflow } from "./new-user-workflow";
import {
  positionAssignmentCreatedNotification,
  positionAssignmentDeletedNotification,
} from "./position-assignment-notifications";
import { reconcileGroupMembershipWorkflow } from "./reconcile-group-membership";
import { reconcileUserGroupMembershipWorkflow } from "./reconcile-user-group-membership";
import { syncGroupsCron } from "./sync-groups-cron";

export const inngestFunctions = [
  gocardlessEventsCleanupCron,
  syncGroupsCron,
  membershipAdmissionWorkflow,
  membershipCancellationWorkflow,
  membershipPaymentProposalsCron,
  membershipReconfirmationWorkflow,
  membershipTransitionWorkflow,
  onboardNewUserWorkflow,
  positionAssignmentCreatedNotification,
  positionAssignmentDeletedNotification,
  reconcileGroupMembershipWorkflow,
  reconcileUserGroupMembershipWorkflow,
];
