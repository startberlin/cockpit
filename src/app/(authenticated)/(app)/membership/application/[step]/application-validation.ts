import { z } from "zod";

export const applicationAddressSchema = z.object({
  street: z.string().min(1, "Please enter your street."),
  city: z.string().min(1, "Please enter your city."),
  state: z.string().min(1, "Please enter your state / region."),
  zip: z.string().min(1, "Please enter your postal code."),
  country: z.string().min(1, "Please enter your country."),
});

export type ApplicationAddressFormData = z.infer<
  typeof applicationAddressSchema
>;

export const applicationDeclarationsSchema = z.object({
  naturalPerson: z.literal(true),
  legalCapacity: z.literal(true),
  supportsPurpose: z.literal(true),
  acceptsBylaws: z.literal(true),
  acceptsPrivacyNotice: z.literal(true),
  acknowledgesFee: z.literal(true),
});

export type ApplicationDeclarationsFormData = z.infer<
  typeof applicationDeclarationsSchema
>;

export const submitApplicationSchema = z.object({
  legalMembershipId: z.string().min(1),
  address: applicationAddressSchema,
  declarations: applicationDeclarationsSchema,
});

export type SubmitApplicationFormData = z.infer<typeof submitApplicationSchema>;
