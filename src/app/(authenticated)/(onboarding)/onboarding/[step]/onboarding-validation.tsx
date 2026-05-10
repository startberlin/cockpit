import { z } from "zod";

export const stepMasterDataSchema = z.object({
  personalEmail: z.email("Please enter your personal email address."),
  phone: z.e164("Please enter your phone number."),
  birthDate: z.string().date("Please enter your date of birth."),
});

export type StepMasterDataFormData = z.infer<typeof stepMasterDataSchema>;
