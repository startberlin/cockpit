import { FlaskConical } from "lucide-react";
import BubblesIcon from "@/assets/bubbles-icon.svg";
import CanvaIcon from "@/assets/canva-icon.svg";
import GmailIcon from "@/assets/gmail-icon.svg";
import GoogleDriveIcon from "@/assets/google-drive-icon.svg";
import GoogleMeetIcon from "@/assets/google-meet-icon.svg";
import NotionIcon from "@/assets/notion-logo.svg";
import SlackIcon from "@/assets/slack-icon.svg";
import TallyIcon from "@/assets/tally-icon.svg";
import type { AppId } from "@/lib/apps/registry";
import type { AppIcon } from "@/lib/apps/types";

/**
 * Icons live here rather than on the app definitions because SVG static imports
 * and `lucide-react` both fail to resolve under `node --test`, which would make
 * the registry untestable.
 *
 * Typed as `Record<AppId, AppIcon>`, so registering an app without an icon is a
 * compile error rather than a hole in the UI.
 */
export const APP_ICONS: Record<AppId, AppIcon> = {
  example: { kind: "lucide", icon: FlaskConical },
  slack: { kind: "image", src: SlackIcon },
  gmail: { kind: "image", src: GmailIcon },
  "google-meet": { kind: "image", src: GoogleMeetIcon },
  notion: { kind: "image", src: NotionIcon },
  "google-drive": { kind: "image", src: GoogleDriveIcon },
  tally: { kind: "image", src: TallyIcon },
  canva: { kind: "image", src: CanvaIcon },
  bubbles: { kind: "image", src: BubblesIcon },
};

export function getAppIcon(id: string): AppIcon | undefined {
  return APP_ICONS[id as AppId];
}
