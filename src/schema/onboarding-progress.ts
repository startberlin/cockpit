import {
  stepAddressDataSchema,
  stepMasterDataSchema,
} from "@/app/(authenticated)/(onboarding)/onboarding/[step]/onboarding-validation";
import type { User } from "../db/schema/auth";

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

export function getOnboardingProgress(
  user: User,
): "master-data" | "address" | "completed" {
  const masterDataValidation = stepMasterDataSchema.safeParse({
    personalEmail: user.personalEmail,
    phone: user.phone,
  });

  if (!masterDataValidation.success) {
    return "master-data";
  }

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

  return "completed";
}
