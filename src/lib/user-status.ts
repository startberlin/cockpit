import type { UserStatus } from "@/db/schema/auth";

export const USER_STATUS_INFO: Record<
  UserStatus,
  { label: string; description: string }
> = {
  onboarding: {
    label: "Onboarding",
    description: "New members that are currently in the onboarding process.",
  },
  member: {
    label: "Member",
    description: "Members that are actively working on projects and events.",
  },
  supporting_alumni: {
    label: "Supporting Alumni",
    description:
      "Former members who that are still part of START Berlin and support the community.",
  },
  alumni: {
    label: "Alumni",
    description: "Former members who are no longer part of START Berlin.",
  },
  cancelled: {
    label: "Cancelled",
    description: "Members whose membership has been cancelled.",
  },
} as const;

export const DEFAULT_PEOPLE_STATUSES = [
  "onboarding",
  "member",
  "paused",
  "supporting_alumni",
] as const;

export const PEOPLE_STATUSES = [
  ...DEFAULT_PEOPLE_STATUSES,
  "alumni",
  "cancelled",
] as const;

export type PeopleStatus = (typeof PEOPLE_STATUSES)[number];

export function getPeopleStatus(
  status: UserStatus,
  participationPausedAt: Date | null,
): PeopleStatus {
  return status === "member" && participationPausedAt ? "paused" : status;
}

export function getPeopleStatusInfo(status: PeopleStatus) {
  return status === "paused"
    ? {
        label: "Paused",
        description: "This member is taking a break from active participation.",
      }
    : USER_STATUS_INFO[status];
}

export function formatParticipationDate(date: Date | string): string {
  return participationDateFormatter.format(new Date(date));
}

const participationDateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "Europe/Berlin",
});
