import { serve } from "inngest/next";
import { onboardNewUserWorkflow } from "@/inngest/new-user-workflow";
import { inngest } from "@/lib/inngest";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [onboardNewUserWorkflow],
});
