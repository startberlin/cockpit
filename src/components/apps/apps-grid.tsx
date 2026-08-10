import type { AppSection } from "@/lib/apps/registry";
import type { AppCopyContext } from "@/lib/apps/types";
import { AppCard } from "./app-card";

interface AppsGridProps {
  title: string;
  description: string;
  sections: AppSection[];
  copyContext: AppCopyContext;
}

/**
 * The launcher body. Replaces the former hardcoded `ToolsSection`: sections and
 * their order come from the registry, so adding an app is a registry edit.
 */
export function AppsGrid({
  title,
  description,
  sections,
  copyContext,
}: AppsGridProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="flex flex-col gap-10">
        {sections.map((section) => (
          <div key={section.category} className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold">{section.label}</h3>
            <div className="grid md:grid-cols-3 grid-cols-1 sm:grid-cols-2 gap-2">
              {section.apps.map((app) => (
                <AppCard key={app.id} app={app} copyContext={copyContext} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
