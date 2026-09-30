import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type AppCopyContext,
  type AppDefinition,
  resolveCopy,
} from "@/lib/apps/types";
import { AppIconGlyph } from "./app-icon";
import { AppLauncher } from "./app-launcher";

export function AppCard({
  app,
  copyContext,
}: {
  app: AppDefinition;
  copyContext: AppCopyContext;
}) {
  return (
    <Card className="@container/card flex flex-col">
      <CardHeader className="gap-2">
        {/* className stays exactly "mb-3": lucide icons already default to
            24px, matching the width/height used for the image icons. */}
        <AppIconGlyph
          appId={app.id}
          alt={app.name}
          size={24}
          className="mb-3"
        />
        <CardTitle>{app.name}</CardTitle>
        <CardDescription>
          {resolveCopy(app.description, copyContext)}
        </CardDescription>
      </CardHeader>
      <CardFooter className="mt-auto">
        <AppLauncher app={app} actionLabel={copyContext.actionLabel} />
      </CardFooter>
    </Card>
  );
}
