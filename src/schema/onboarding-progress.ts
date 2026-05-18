import { stepMasterDataSchema } from "@/app/(authenticated)/(onboarding)/onboarding/[step]/onboarding-validation";
import type { User } from "@/db/schema/auth";

export interface OnboardedUser extends User {
  personalEmail: NonNullable<User["personalEmail"]>;
  phone: NonNullable<User["phone"]>;
  birthDate: NonNullable<User["birthDate"]>;
}

export function isOnboardedUser(
  user: Pick<User, "personalEmail" | "phone" | "birthDate">,
): user is OnboardedUser {
  return !!(user.personalEmail && user.phone && user.birthDate);
}

const EVENT_EMAIL_PREF_STATUSES: User["status"][] = [
  "onboarding",
  "member",
  "supporting_alumni",
];

type OnboardingProgressUser = Pick<
  User,
  "personalEmail" | "phone" | "birthDate" | "status" | "eventEmailPreference"
>;

export type OnboardingProgress = "master-data" | "event-email" | "completed";

export function getOnboardingProgress(
  user: OnboardingProgressUser,
): OnboardingProgress {
  const masterDataValidation = stepMasterDataSchema.safeParse({
    personalEmail: user.personalEmail,
    phone: user.phone,
    birthDate: user.birthDate,
  });

  if (!masterDataValidation.success) {
    return "master-data";
  }

  if (
    EVENT_EMAIL_PREF_STATUSES.includes(user.status) &&
    !user.eventEmailPreference
  ) {
    return "event-email";
  }

  return "completed";
}
