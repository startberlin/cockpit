import { bootstrapBatchSystemGroupWorkflow } from "./bootstrap-batch-system-group";
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
import { reconfirmationReminderWorkflow } from "./reconfirmation-reminder-workflow";
import { syncManualGroupMemberWorkflow } from "./sync-manual-group-member";
import { syncPositionSystemGroupsWorkflow } from "./sync-position-system-groups";
import { syncSystemGroupsCron } from "./sync-system-groups-cron";
import { syncUserSystemGroupsWorkflow } from "./sync-user-system-groups";

export const inngestFunctions = [
  bootstrapBatchSystemGroupWorkflow,
  financePaymentProposalsDigest,
  gocardlessEventsCleanupCron,
  mandateFixReminderWorkflow,
  mandateSetupReminderWorkflow,
  syncManualGroupMemberWorkflow,
  syncSystemGroupsCron,
  membershipAdmissionWorkflow,
  membershipCancellationWorkflow,
  membershipPaymentProposalsCron,
  membershipReconfirmationWorkflow,
  membershipTransitionWorkflow,
  onboardNewUserWorkflow,
  positionAssignmentCreatedNotification,
  positionAssignmentDeletedNotification,
  reconfirmationReminderWorkflow,
  syncPositionSystemGroupsWorkflow,
  syncUserSystemGroupsWorkflow,
];
