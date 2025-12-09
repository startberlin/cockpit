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
} as const;
