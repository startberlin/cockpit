import { z } from "zod";

const slugPattern = z
  .string()
  .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only.");

const integrationsSchema = z.object({
  email: z.boolean().default(false),
  googleEmailPrefix: slugPattern.optional(),
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
