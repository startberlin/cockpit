import Image from "next/image";
import SlackIcon from "@/assets/slack-icon.svg";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function MembershipOnboarding() {
  return (
    <div className="flex flex-col gap-10">
      <Card>
        <CardHeader>
          <CardTitle>You're in the onboarding phase.</CardTitle>
          <CardDescription>
            We're glad to have you on board. After the onboarding phase, you'll
            see your membership details here.
          </CardDescription>
        </CardHeader>
      </Card>
      <div className="flex flex-col gap-6">
        <span className="flex flex-col gap-1">
          <h2 className="text-md font-semibold">First steps</h2>
          <p className="text-sm text-muted-foreground">
            Set up your most important software accounts
          </p>
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
              <CardTitle>Join Slack</CardTitle>
              <CardDescription>
                Set up your Slack account to stay updated with the latest news
                and announcements.
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <Button variant="default">Join Slack</Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
