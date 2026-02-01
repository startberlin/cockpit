import { z } from "zod";

const integrationsSchema = z
  .object({
    slack: z.boolean().default(false),
    email: z.boolean().default(false),
  })
  .refine((data) => data.slack || data.email, {
    message: "Please select at least one option.",
  });

export const createGroupSchema = z.object({
  name: z.string().min(1, "Please enter a group name."),
  slug: z
    .string()
    .min(1, "Please enter a slug.")
    .regex(
      /^[a-z0-9-]+$/,
      "Slug must be lowercase letters, numbers, and hyphens only.",
    ),
  integrations: integrationsSchema,
});

export type CreateGroupFormData = z.infer<typeof createGroupSchema>;
