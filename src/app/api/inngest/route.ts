import { serve } from "inngest/next";
import { startWorkflow } from "@/inngest/test-workflow";
import { inngest } from "@/lib/inngest";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [startWorkflow],
});
