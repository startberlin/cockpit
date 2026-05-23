import StartCockpitEnabledEmail from "@/emails/auth/start-cockpit-enabled";
import type { ImportableUserStatus } from "./import-google-user-schema";

export function buildImportedUserNotificationEmail({
  email,
  firstName,
  status,
}: {
  email: string;
  firstName: string;
  status: ImportableUserStatus;
}) {
  return {
    from: "START Berlin <notifications@cockpit.start-berlin.com>",
    to: email,
    subject: "Your START Cockpit access is ready",
    react: StartCockpitEnabledEmail({
      firstName,
      statusContext: status,
    }),
  };
}
