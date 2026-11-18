import type { InternalAppDefinition } from "@/lib/apps/types";

export const jobboardApp: InternalAppDefinition = {
  kind: "internal",
  id: "jobboard",
  name: "Jobboard",
  category: "internal",
  analyticsId: "jobboard",
  basePath: "/jobboard",
  visibility: { kind: "permission", action: "apps.jobboard.access" },
  description: "Manage network opportunities and their distribution.",
  nav: {
    items: [
      { label: "Overview", icon: "dashboard", href: "/jobboard" },
      { label: "Jobs", icon: "briefcase", href: "/jobboard/jobs" },
      { label: "Submissions", icon: "inbox", href: "/jobboard/submissions" },
      { label: "Companies", icon: "building", href: "/jobboard/companies" },
      { label: "Analytics", icon: "chart", href: "/jobboard/analytics" },
      { label: "Settings", icon: "settings", href: "/jobboard/settings" },
    ],
  },
};
