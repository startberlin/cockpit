import { desc, eq } from "drizzle-orm";
import db from "@/db";
import { getMemberSinceDate } from "@/db/membership";
import { getUserDetails } from "@/db/people";
import { session } from "@/db/schema/auth";
import { USER_STATUS_INFO } from "@/lib/user-status";
import { cn } from "@/lib/utils";

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatLastSignIn(date: Date): string {
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    return `Today, ${date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
  }

  return formatDate(date);
}

interface MemberSummaryStripProps {
  userId: string;
}

export async function MemberSummaryStrip({ userId }: MemberSummaryStripProps) {
  const user = await getUserDetails(userId);
  if (!user) return null;

  const [memberSince, lastSession] = await Promise.all([
    getMemberSinceDate(userId),
    db.query.session.findFirst({
      where: eq(session.userId, userId),
      orderBy: [desc(session.updatedAt)],
      columns: { updatedAt: true },
    }),
  ]);

  const items = [
    { label: "Status", value: USER_STATUS_INFO[user.status].label },
    {
      label: "Member since",
      value: memberSince ? formatDate(memberSince) : "—",
    },
    {
      label: "Batch",
      value: user.batchNumber != null ? `#${user.batchNumber}` : "—",
    },
    {
      label: "Last sign-in",
      value: lastSession ? formatLastSignIn(lastSession.updatedAt) : "Never",
    },
  ];

  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-lg border sm:grid-cols-4">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={cn(
            "px-4 py-3",
            i % 2 === 0 && "border-r",
            i < 2 && "border-b sm:border-b-0",
            i === 1 && "sm:border-r",
          )}
        >
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            {item.label}
          </p>
          <p className="mt-0.5 text-sm font-medium">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
