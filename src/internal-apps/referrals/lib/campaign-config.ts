import { z } from "zod";

export const campaignConfigSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(100),
    name: z.string().min(1).max(100),
    batchNumber: z.number().int().positive().nullable(),
    formId: z
      .string()
      .regex(/^[a-zA-Z0-9]+$/)
      .max(128),
    applicationUrl: z.url().refine((value) => {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        [
          "apply.start-berlin.com",
          "tally.so",
          "forms.start-berlin.com",
        ].includes(url.hostname)
      );
    }, "Use a START Berlin application URL or tally.so"),
    refFieldKey: z.string().startsWith("question_").max(256),
    campaignFieldKey: z.string().startsWith("question_").max(256),
    opensAt: z.iso.datetime({ offset: true }),
    closesAt: z.iso.datetime({ offset: true }),
  })
  .refine(
    (config) => config.refFieldKey !== config.campaignFieldKey,
    "Hidden fields must have different keys",
  )
  .refine(
    (config) => new Date(config.closesAt) > new Date(config.opensAt),
    "Closing time must follow opening time",
  );
