import {
  stepAddressDataSchema,
  stepMasterDataSchema,
} from "@/app/(authenticated)/(onboarding)/onboarding/[step]/onboarding-validation";
import type { LegalMembershipState, User } from "@/db/schema/auth";

export interface OnboardedUser extends User {
  street: NonNullable<User["street"]>;
  city: NonNullable<User["city"]>;
  state: NonNullable<User["state"]>;
  zip: NonNullable<User["zip"]>;
  country: NonNullable<User["country"]>;
  phone: NonNullable<User["phone"]>;
}

export function isOnboardedUser(
  user: Pick<User, "street" | "city" | "state" | "zip" | "country" | "phone">,
): user is OnboardedUser {
  return !!(
    user.street &&
    user.city &&
    user.state &&
    user.zip &&
    user.country &&
    user.phone
  );
}

function requiresAddress(legalMembershipState: LegalMembershipState): boolean {
  return (
    legalMembershipState === "active_member" ||
    legalMembershipState === "former_member"
  );
}

type OnboardingProgressUser = Pick<
  User,
  | "personalEmail"
  | "phone"
  | "street"
  | "city"
  | "state"
  | "zip"
  | "country"
  | "legalMembershipState"
>;

export type OnboardingProgress = "master-data" | "address" | "completed";

export function getOnboardingProgress(
  user: OnboardingProgressUser,
): OnboardingProgress {
  const masterDataValidation = stepMasterDataSchema.safeParse({
    personalEmail: user.personalEmail,
    phone: user.phone,
  });

  if (!masterDataValidation.success) {
    return "master-data";
  }

  if (requiresAddress(user.legalMembershipState)) {
    const addressValidation = stepAddressDataSchema.safeParse({
      street: user.street,
      city: user.city,
      state: user.state,
      zip: user.zip,
      country: user.country,
    });

    if (!addressValidation.success) {
      return "address";
    }
  }

  return "completed";
}
