import { channel } from "inngest/realtime";
import { z } from "zod";

export const membershipActivatedChannel = channel({
  name: (legalMembershipId: string) =>
    `membership-activated:${legalMembershipId}`,
  topics: {
    activated: {
      schema: z.object({ legalMembershipId: z.string() }),
    },
  },
});

export const mandateActivatedChannel = channel({
  name: (userId: string) => `mandate-activated:${userId}`,
  topics: {
    activated: {
      schema: z.object({ userId: z.string() }),
    },
  },
});
