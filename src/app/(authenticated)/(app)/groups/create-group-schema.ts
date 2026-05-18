import { z } from "zod";

const slugPattern = z
  .string()
  .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only.");

const integrationsSchema = z
  .object({
    slack: z.boolean().default(false),
    slackChannelSlug: slugPattern.optional(),
    email: z.boolean().default(false),
    googleEmailPrefix: slugPattern.optional(),
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
