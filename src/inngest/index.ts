import { financePaymentProposalsDigest } from "./finance-payment-proposals-digest";
import { gocardlessEventsCleanupCron } from "./gocardless-events-cleanup";
import { mandateFixReminderWorkflow } from "./mandate-fix-reminder-workflow";
import { mandateSetupReminderWorkflow } from "./mandate-setup-reminder-workflow";
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
import { reconfirmationReminderWorkflow } from "./reconfirmation-reminder-workflow";
import { syncGroupsCron } from "./sync-groups-cron";
import { syncUserSystemGroupsWorkflow } from "./sync-user-system-groups";

export const inngestFunctions = [
  financePaymentProposalsDigest,
  gocardlessEventsCleanupCron,
  mandateFixReminderWorkflow,
  mandateSetupReminderWorkflow,
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
  reconfirmationReminderWorkflow,
  syncUserSystemGroupsWorkflow,
];
