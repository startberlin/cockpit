import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { AppDefinition } from "@/lib/apps/types";
import { getDialogLauncher } from "./launchers";

/**
 * The action in an app card's footer. Server component: it renders client
 * dialogs but only ever passes them serializable props.
 */
export function AppLauncher({
  app,
  actionLabel,
}: {
  app: AppDefinition;
  actionLabel: string;
}) {
  if (app.kind === "internal") {
    return (
      <Button variant="outline" size="sm" asChild>
        <Link
          href={app.basePath}
          data-ph-capture-attribute-service={app.analyticsId}
        >
          Open {app.name}
        </Link>
      </Button>
    );
  }

  if (app.launcher.type === "link") {
    return (
      <Button variant="outline" size="sm" asChild>
        <Link
          href={app.launcher.href}
          target="_blank"
          rel="noopener noreferrer"
          data-ph-capture-attribute-service={app.analyticsId}
        >
          <ExternalLink />
          {actionLabel} {app.name}
        </Link>
      </Button>
    );
  }

  const Dialog = getDialogLauncher(app.id);
  if (!Dialog) return null;

  return <Dialog actionLabel={actionLabel} />;
}
