import type { LucideIcon } from "lucide-react";
import type { StaticImageData } from "next/image";
import type { UserStatus } from "@/db/schema/auth";
import type { AppVisibility } from "./visibility";

/**
 * An "app" is anything a member can open from the launcher: an external SaaS
 * workspace (Slack, Notion, ...) or an internal app built inside this codebase.
 *
 * Definitions live in `external.ts` (SaaS) or in `src/internal-apps/<slug>/app.ts`
 * (internal), and are collected in `registry.ts`.
 *
 * Two rules keep this layer usable:
 *
 *  - **Client-safe.** The sidebar is a client component and imports the registry
 *    directly, so nothing here may reach for `server-only` or `@/db`.
 *  - **No renderable assets.** Definitions carry no icons and no components —
 *    only plain data and functions. SVG static imports and `lucide-react` both
 *    fail to resolve under `node --test`, so holding them here would make the
 *    registry untestable. Icons live in `src/components/apps/app-icons.tsx` and
 *    dialogs in `src/components/apps/launchers.tsx`, both keyed by app id and
 *    both checked exhaustively against `AppId` at compile time.
 */

// The order of this array is the section order on /tools.
export const appCategories = [
  "internal",
  "communication",
  "collaboration",
  "productivity",
] as const;

export type AppCategory = (typeof appCategories)[number];

export const APP_CATEGORY_LABELS: Record<AppCategory, string> = {
  internal: "START Berlin apps",
  communication: "Communication",
  collaboration: "Collaboration",
  productivity: "Productivity",
};

/**
 * The value type of the icon map in `src/components/apps/app-icons.tsx`.
 * Deliberately not a field on `AppDefinition` — see the note above.
 */
export type AppIcon =
  | { kind: "image"; src: StaticImageData }
  | { kind: "lucide"; icon: LucideIcon };

export type AppCopyContext = {
  /** "Join" while onboarding, otherwise "Open". */
  actionLabel: string;
  status: UserStatus;
};

export type AppCopy = string | ((ctx: AppCopyContext) => string);

interface AppBase {
  id: string;
  name: string;
  description: AppCopy;
  category: AppCategory;
  visibility: AppVisibility;
  /**
   * Value for `data-ph-capture-attribute-service`. Existing PostHog insights key
   * off these slugs — never rename one for an app that already shipped.
   */
  analyticsId: string;
}

export interface ExternalAppDefinition extends AppBase {
  kind: "external";
  /**
   * `dialog` intentionally carries no component reference. The registry is
   * imported by the sidebar (a client component); holding component references
   * here would pull every tool dialog and its server actions into the sidebar
   * chunk on every page. Dialogs are keyed by app id in
   * `src/components/apps/launchers.tsx`, which only /tools imports.
   */
  launcher: { type: "link"; href: string } | { type: "dialog" };
}

export interface InternalAppNavItem {
  label: string;
  href: string;
}

export interface InternalAppDefinition extends AppBase {
  kind: "internal";
  basePath: `/${string}`;
  /** Sidebar entry. The icon comes from the icon map, keyed by `id`. */
  nav?: {
    /** Defaults to `name`. */
    label?: string;
    items?: readonly InternalAppNavItem[];
  };
}

export type AppDefinition = ExternalAppDefinition | InternalAppDefinition;

export function resolveCopy(copy: AppCopy, ctx: AppCopyContext): string {
  return typeof copy === "function" ? copy(ctx) : copy;
}
