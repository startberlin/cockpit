import { serve } from "inngest/next";
import { inngestFunctions } from "@/inngest";
import { inngest } from "@/lib/inngest";

export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: inngestFunctions,
});
