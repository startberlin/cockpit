import { z } from "zod";

export const settingsSchema = z
  .object({
    personalEmail: z.email("Please enter a valid email address."),
    phone: z.e164("Please enter a valid phone number."),
    street: z.string().min(1, "Please enter your street."),
    city: z.string().min(1, "Please enter your city."),
    state: z.string(),
    zip: z.string().min(1, "Please enter your postal code."),
    country: z.string().min(1, "Please enter your country."),
    eventEmailPreference: z
      .enum(["personal_email", "start_email", "custom"])
      .optional(),
    eventInviteEmail: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.eventEmailPreference === "custom") {
      if (!z.email().safeParse(data.eventInviteEmail ?? "").success) {
        ctx.addIssue({
          code: "custom",
          message: "Please enter a valid email address.",
          path: ["eventInviteEmail"],
        });
      }
    }
  });

export type SettingsFormData = z.infer<typeof settingsSchema>;
