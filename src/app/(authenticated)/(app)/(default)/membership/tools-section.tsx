import { ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import BubblesIcon from "@/assets/bubbles-icon.svg";
import CanvaIcon from "@/assets/canva-icon.svg";
import GmailIcon from "@/assets/gmail-icon.svg";
import GoogleDriveIcon from "@/assets/google-drive-icon.svg";
import GoogleMeetIcon from "@/assets/google-meet-icon.svg";
import NotionIcon from "@/assets/notion-logo.svg";
import SlackIcon from "@/assets/slack-icon.svg";
import TallyIcon from "@/assets/tally-icon.svg";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BubblesDialog } from "./bubbles-dialog";
import { CanvaDialog } from "./canva-dialog";
import { NotionDialog } from "./notion-dialog";
import { SlackDialog } from "./slack-dialog";
import { TallyDialog } from "./tally-dialog";

interface ToolsSectionProps {
  title: string;
  description: string;
  actionLabel: string;
}

export function ToolsSection({
  title,
  description,
  actionLabel,
}: ToolsSectionProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="flex flex-col gap-10">
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">Communication</h3>
          <div className="grid md:grid-cols-3 grid-cols-1 sm:grid-cols-2 gap-2">
            <Card className="@container/card flex flex-col">
              <CardHeader className="gap-2">
                <Image
                  src={SlackIcon}
                  className="mb-3"
                  alt="Slack"
                  width={24}
                  height={24}
                />
                <CardTitle>Slack</CardTitle>
                <CardDescription>
                  {actionLabel === "Join"
                    ? "Join Slack to coordinate with the START Berlin team day-to-day."
                    : "Open Slack to coordinate with the START Berlin team day-to-day."}
                </CardDescription>
              </CardHeader>
              <CardFooter className="mt-auto">
                <SlackDialog actionLabel={actionLabel} />
              </CardFooter>
            </Card>

            <Card className="@container/card flex flex-col">
              <CardHeader className="gap-2">
                <Image
                  src={GmailIcon}
                  className="mb-3"
                  alt="Gmail"
                  width={24}
                  height={24}
                />
                <CardTitle>Gmail</CardTitle>
                <CardDescription>
                  {actionLabel} Gmail to send and receive emails for START
                  Berlin.
                </CardDescription>
              </CardHeader>
              <CardFooter className="mt-auto">
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href="https://mail.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink />
                    {actionLabel} Gmail
                  </Link>
                </Button>
              </CardFooter>
            </Card>

            <Card className="@container/card flex flex-col">
              <CardHeader className="gap-2">
                <Image
                  src={GoogleMeetIcon}
                  className="mb-3"
                  alt="Google Meet"
                  width={24}
                  height={24}
                />
                <CardTitle>Google Meet</CardTitle>
                <CardDescription>
                  {actionLabel} Google Meet to start or attend online video
                  calls.
                </CardDescription>
              </CardHeader>
              <CardFooter className="mt-auto">
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href="https://meet.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink />
                    {actionLabel} Google Meet
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">Collaboration</h3>
          <div className="grid md:grid-cols-3 grid-cols-1 sm:grid-cols-2 gap-2">
            <Card className="@container/card flex flex-col">
              <CardHeader className="gap-2">
                <Image
                  src={NotionIcon}
                  className="mb-3"
                  alt="Notion"
                  width={24}
                  height={24}
                />
                <CardTitle>Notion</CardTitle>
                <CardDescription>
                  {actionLabel === "Join"
                    ? "Join Notion to access START Berlin's shared docs and project resources."
                    : "Open Notion to access START Berlin's shared docs and project resources."}
                </CardDescription>
              </CardHeader>
              <CardFooter className="mt-auto">
                <NotionDialog actionLabel={actionLabel} />
              </CardFooter>
            </Card>

            <Card className="@container/card flex flex-col">
              <CardHeader className="gap-2">
                <Image
                  src={GoogleDriveIcon}
                  className="mb-3"
                  alt="Google Drive"
                  width={24}
                  height={24}
                />
                <CardTitle>Google Drive</CardTitle>
                <CardDescription>
                  {actionLabel} Google Drive to access and collaborate on files
                  shared across START Berlin.
                </CardDescription>
              </CardHeader>
              <CardFooter className="mt-auto">
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href="https://drive.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink />
                    {actionLabel} Google Drive
                  </Link>
                </Button>
              </CardFooter>
            </Card>

            <Card className="@container/card flex flex-col">
              <CardHeader className="gap-2">
                <Image
                  src={TallyIcon}
                  className="mb-3"
                  alt="Tally"
                  width={24}
                  height={24}
                />
                <CardTitle>Tally</CardTitle>
                <CardDescription>
                  {actionLabel} Tally to create and manage forms and surveys.
                </CardDescription>
              </CardHeader>
              <CardFooter className="mt-auto">
                <TallyDialog actionLabel={actionLabel} />
              </CardFooter>
            </Card>

            <Card className="@container/card flex flex-col">
              <CardHeader className="gap-2">
                <Image
                  src={CanvaIcon}
                  className="mb-3"
                  alt="Canva"
                  width={24}
                  height={24}
                />
                <CardTitle>Canva</CardTitle>
                <CardDescription>
                  {actionLabel} Canva to design social media posts, slide decks,
                  and presentations for START Berlin.
                </CardDescription>
              </CardHeader>
              <CardFooter className="mt-auto">
                <CanvaDialog actionLabel={actionLabel} />
              </CardFooter>
            </Card>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">Productivity</h3>
          <div className="grid md:grid-cols-3 grid-cols-1 sm:grid-cols-2 gap-2">
            <Card className="@container/card flex flex-col">
              <CardHeader className="gap-2">
                <Image
                  src={BubblesIcon}
                  className="mb-3"
                  alt="Bubbles"
                  width={24}
                  height={24}
                />
                <CardTitle>Bubbles</CardTitle>
                <CardDescription>
                  {actionLabel} Bubbles to record, transcribe, and summarise
                  meetings and share async video clips with the team.
                </CardDescription>
              </CardHeader>
              <CardFooter className="mt-auto">
                <BubblesDialog actionLabel={actionLabel} />
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
