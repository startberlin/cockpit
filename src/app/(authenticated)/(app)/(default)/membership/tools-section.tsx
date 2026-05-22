import Image from "next/image";
import NotionIcon from "@/assets/notion-logo.svg";
import SlackIcon from "@/assets/slack-icon.svg";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NotionDialog } from "./notion-dialog";
import { SlackDialog } from "./slack-dialog";

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
  const slackTitle = `${actionLabel} Slack`;
  const notionTitle = `${actionLabel} Notion`;

  return (
    <div className="flex flex-col gap-6">
      <span className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </span>
      <div className="grid md:grid-cols-3 grid-cols-1 sm:grid-cols-2 gap-2">
        <Card className="@container/card">
          <CardHeader className="gap-2">
            <Image
              src={SlackIcon}
              className="mb-3"
              alt="Slack"
              width={24}
              height={24}
            />
            <CardTitle>{slackTitle}</CardTitle>
            <CardDescription>
              {actionLabel === "Join"
                ? "Join Slack for START Berlin communication, updates, and day-to-day coordination."
                : "Open Slack for START Berlin communication, updates, and day-to-day coordination."}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <SlackDialog actionLabel={actionLabel} />
          </CardFooter>
        </Card>
        <Card className="@container/card">
          <CardHeader className="gap-2">
            <Image
              src={NotionIcon}
              className="mb-3"
              alt="Notion"
              width={24}
              height={24}
            />
            <CardTitle>{notionTitle}</CardTitle>
            <CardDescription>
              {actionLabel === "Join"
                ? "Join Notion to access START Berlin resources, project docs, and internal information."
                : "Open Notion to access START Berlin resources, project docs, and internal information."}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <NotionDialog actionLabel={actionLabel} />
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
