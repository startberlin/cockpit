import { z } from "zod";

export const settingsSchema = z.object({
  personalEmail: z.email("Please enter a valid email address."),
  phone: z.e164("Please enter a valid phone number."),
  street: z.string().min(1, "Please enter your street."),
  city: z.string().min(1, "Please enter your city."),
  state: z.string(),
  zip: z.string().min(1, "Please enter your postal code."),
  country: z.string().min(1, "Please enter your country."),
});

export type SettingsFormData = z.infer<typeof settingsSchema>;
