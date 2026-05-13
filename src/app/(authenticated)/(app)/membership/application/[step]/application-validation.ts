import { z } from "zod";

export const applicationAddressSchema = z.object({
  street: z.string().min(1, "Please enter your street."),
  city: z.string().min(1, "Please enter your city."),
  state: z.string(),
  zip: z.string().min(1, "Please enter your postal code."),
  country: z.string().min(1, "Please enter your country."),
  birthDate: z
    .string()
    .min(1, "Please enter your date of birth.")
    .refine((val) => {
      const birth = new Date(val);
      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - 18);
      return birth <= cutoff;
    }, "You must be at least 18 years old to apply for membership."),
});

export type ApplicationAddressFormData = z.infer<
  typeof applicationAddressSchema
>;

export const applicationPersonalInfoSchema = applicationAddressSchema.extend({
  legalMembershipId: z.string().min(1),
  personalEmail: z.email("Please enter a valid email address."),
  phone: z.e164("Please enter a valid phone number."),
});

export const declarationStepSchema = z.object({
  legalMembershipId: z.string().min(1),
});

export type ApplicationPersonalInfoFormData = z.infer<
  typeof applicationPersonalInfoSchema
>;

export const applicationDeclarationsSchema = z.object({
  naturalPerson: z.literal(true),
  legalCapacity: z.literal(true),
  supportsPurpose: z.literal(true),
  acceptsBylaws: z.literal(true),
  acceptsFinancialRegulations: z.literal(true),
  acknowledgesFee: z.literal(true),
});

export type ApplicationDeclarationsFormData = z.infer<
  typeof applicationDeclarationsSchema
>;

export const submitApplicationSchema = z.object({
  legalMembershipId: z.string().min(1),
});

export type SubmitApplicationFormData = z.infer<typeof submitApplicationSchema>;
