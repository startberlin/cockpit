import StartCockpitEnabledEmail from "@/emails/start-cockpit-enabled";
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
    subject: "You can now use START Cockpit",
    react: StartCockpitEnabledEmail({
      firstName,
      statusContext: status,
    }),
  };
}
