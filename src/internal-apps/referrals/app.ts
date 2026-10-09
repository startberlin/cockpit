import type { InternalAppDefinition } from "@/lib/apps/types";

export const referralsApp = {
  kind: "internal",
  id: "referrals",
  name: "Referrals",
  category: "internal",
  analyticsId: "referrals",
  basePath: "/referrals",
  visibility: { kind: "permission", action: "apps.referrals.access" },
  description: "Your application link and referrals.",
  nav: { items: [{ label: "My referrals", href: "/referrals" }] },
} as const satisfies InternalAppDefinition;
