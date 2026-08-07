import type { InternalAppDefinition } from "@/lib/apps/types";

/**
 * A throwaway app that exists to prove the internal-app seams work end to end:
 * registry entry, route group + access-guarded layout, its own table and
 * migration, its own permission, a server action, and a sidebar entry.
 *
 * Gated on `apps.example.access` (super admins only), so it is invisible in
 * production.
 *
 * ## Deleting it
 *
 * 1. `rm -rf src/internal-apps/example src/app/(authenticated)/(apps)/example`
 * 2. Drop `exampleApp` from `src/lib/apps/registry.ts`
 * 3. Drop the `example` entry from `src/components/apps/app-icons.tsx`
 * 4. Drop `"apps.example.access"` from `globalActions` and its `switch` case in
 *    `src/lib/permissions/evaluate.ts`, plus its `describe` block in
 *    `permissions.test.ts`
 * 5. Drop `exampleNote` from `prefixes` in `src/lib/id.ts`
 * 6. `npm run db:generate` (emits the DROP TABLE) then `npm run db:migrate`
 *
 * Nothing else moves. Everything the registry, route group, and app shell need
 * stays in place for the next app.
 *
 * NOTE: this file is pulled into the sidebar's client bundle, so it may import
 * only types, `lucide-react`, and plain constants — never `@/db`, `server-only`,
 * or an action file.
 */
export const exampleApp: InternalAppDefinition = {
  kind: "internal",
  id: "example",
  name: "Example app",
  category: "internal",
  analyticsId: "example",
  basePath: "/example",
  visibility: { kind: "permission", action: "apps.example.access" },
  description:
    "A scaffold app proving the internal-app seams. Safe to delete once a real app exists.",
  // Rendered as the app's own sidebar by AppShellSidebar. Two entries so the
  // scaffold actually demonstrates in-app navigation.
  nav: {
    items: [
      { label: "Notes", href: "/example" },
      { label: "About", href: "/example/about" },
    ],
  },
};
