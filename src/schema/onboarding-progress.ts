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

type OnboardingProgressUser = Pick<
  User,
  "personalEmail" | "phone" | "birthDate"
>;

export type OnboardingProgress = "master-data" | "completed";

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

  return "completed";
}
