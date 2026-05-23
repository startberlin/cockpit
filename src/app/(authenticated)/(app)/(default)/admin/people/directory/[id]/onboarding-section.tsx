import { desc, eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import db from "@/db";
import { getUserDetails } from "@/db/people";
import { session } from "@/db/schema/auth";

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
      {children}
    </p>
  );
}

interface OnboardingSectionProps {
  userId: string;
}

export async function OnboardingSection({ userId }: OnboardingSectionProps) {
  const user = await getUserDetails(userId);
  if (!user) return null;

  const lastSession = await db.query.session.findFirst({
    where: eq(session.userId, userId),
    orderBy: [desc(session.updatedAt)],
    columns: { updatedAt: true },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Onboarding</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <FieldLabel>Profile status</FieldLabel>
            {user.profileOnboardingComplete ? (
              <Badge
                variant="outline"
                className="border-green-600 text-green-700"
              >
                Complete
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                Not yet complete
              </Badge>
            )}
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Last active</FieldLabel>
            <p className="text-sm font-medium">
              {lastSession ? formatDate(lastSession.updatedAt) : "Never"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
