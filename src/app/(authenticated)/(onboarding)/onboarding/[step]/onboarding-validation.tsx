import { z } from "zod";

export const stepMasterDataSchema = z.object({
  personalEmail: z.email("Please enter your personal email address."),
  phone: z.e164("Please enter your phone number."),
});

export type StepMasterDataFormData = z.infer<typeof stepMasterDataSchema>;

export const stepAddressDataSchema = z.object({
  street: z.string().min(1, "Please enter your street."),
  city: z.string().min(1, "Please enter your city."),
  state: z.string().min(1, "Please enter your state."),
  zip: z.string().min(1, "Please enter your zip code."),
  country: z.string().min(1, "Please enter your country."),
});

export type StepAddressDataFormData = z.infer<typeof stepAddressDataSchema>;

export const completeOnboardingSchema = z.object({
  masterData: stepMasterDataSchema,
  address: stepAddressDataSchema,
});

export type OnboardingFormData = z.infer<typeof completeOnboardingSchema>;
