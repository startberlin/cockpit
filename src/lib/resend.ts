import { Resend } from "resend";
import { env } from "@/env";

const client = new Resend(env.RESEND_API_KEY);

const isProduction = process.env.VERCEL_ENV === "production";

export const resend = {
  emails: {
    send: (
      ...args: Parameters<typeof client.emails.send>
    ): ReturnType<typeof client.emails.send> => {
      const [payload, options] = args;

      const subject =
        isProduction || !payload.subject
          ? payload.subject
          : `[TEST] ${payload.subject}`;

      return client.emails.send(
        { ...payload, subject } as Parameters<typeof client.emails.send>[0],
        options,
      );
    },
  },
};
