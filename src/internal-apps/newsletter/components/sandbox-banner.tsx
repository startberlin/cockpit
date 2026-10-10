import { FlaskConical } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Standing reminder that nothing is actually being delivered. Deliberately
 * always visible rather than a dismissible toast: the difference between
 * sandbox and live is the difference between a test and mailing several hundred
 * people, and it should never be a surprise.
 */
export function SandboxBanner({ mode }: { mode: "sandbox" | "live" }) {
  if (mode === "live") return null;

  return (
    <Alert className="mb-6" role="status">
      <FlaskConical />
      <AlertTitle>Sandbox mode</AlertTitle>
      <AlertDescription>
        Sends, imports and adding contacts to a segment are simulated. Syncs and
        analytics read the real Resend account. Draft edits and uploads are
        saved normally.
      </AlertDescription>
    </Alert>
  );
}
