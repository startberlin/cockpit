import { and, desc, eq, gt } from "drizzle-orm";
import { MonitorSmartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import db from "@/db";
import { session } from "@/db/schema/auth";

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface ActiveSessionsCardProps {
  userId: string;
}

export async function ActiveSessionsCard({ userId }: ActiveSessionsCardProps) {
  const activeSessions = await db.query.session.findMany({
    where: and(eq(session.userId, userId), gt(session.expiresAt, new Date())),
    orderBy: [desc(session.updatedAt)],
    columns: {
      id: true,
      createdAt: true,
      updatedAt: true,
      expiresAt: true,
      ipAddress: true,
      userAgent: true,
      impersonatedBy: true,
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active sessions</CardTitle>
      </CardHeader>
      <CardContent>
        {activeSessions.length === 0 ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <MonitorSmartphone className="h-4 w-4" />
            No active sessions
          </div>
        ) : (
          <div className="space-y-4">
            {activeSessions.map((s, i) => (
              <div key={s.id}>
                {i > 0 && <Separator className="mb-4" />}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                      Last active
                    </p>
                    <p className="text-sm font-medium">
                      {formatDate(s.updatedAt)}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                      Signed in
                    </p>
                    <p className="text-sm font-medium">
                      {formatDate(s.createdAt)}
                    </p>
                  </div>
                  {s.ipAddress && (
                    <div className="space-y-1.5">
                      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                        IP address
                      </p>
                      <p className="font-mono text-sm">{s.ipAddress}</p>
                    </div>
                  )}
                  {s.impersonatedBy && (
                    <div className="space-y-1.5">
                      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                        Type
                      </p>
                      <Badge
                        variant="outline"
                        className="text-amber-700 border-amber-500"
                      >
                        Impersonated
                      </Badge>
                    </div>
                  )}
                  {s.userAgent && (
                    <div className="col-span-2 space-y-1.5">
                      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                        User agent
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {s.userAgent}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
