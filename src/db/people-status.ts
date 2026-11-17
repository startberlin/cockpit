import { and, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { PeopleStatus } from "@/lib/user-status";
import { user } from "./schema/auth";

/** Only directory and chart filters interpret the stored participation pause. */
export function peopleStatusCondition(statuses: readonly PeopleStatus[]) {
  const otherStatuses = statuses.filter(
    (status) => status !== "member" && status !== "paused",
  );
  const includeMembers = statuses.includes("member");
  const includePaused = statuses.includes("paused");
  const members =
    includeMembers || includePaused
      ? and(
          eq(user.status, "member"),
          includeMembers && includePaused
            ? undefined
            : includePaused
              ? isNotNull(user.participationPausedAt)
              : isNull(user.participationPausedAt),
        )
      : undefined;

  return (
    or(
      otherStatuses.length ? inArray(user.status, otherStatuses) : undefined,
      members,
    ) ?? sql`false`
  );
}
