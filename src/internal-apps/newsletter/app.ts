import type { InternalAppDefinition } from "@/lib/apps/types";

/**
 * Newsletter — the editorial newsletter CMS for the Growth department.
 *
 * Composes an issue from typed blocks, renders it to email HTML, and sends it
 * through Resend Broadcasts. Cockpit's own transactional mail keeps going out
 * over SES; marketing mail is deliberately a separate provider and a separate
 * sending domain (`emails.start-berlin.com`) so newsletter complaints can never
 * damage the deliverability of login and membership mail.
 *
 * NOTE: this file is pulled into the sidebar's client bundle, so it may import
 * only types, `lucide-react`, and plain constants — never `@/db`, `server-only`,
 * or an action file.
 */
export const newsletterApp: InternalAppDefinition = {
  kind: "internal",
  id: "newsletter",
  name: "Newsletter",
  category: "internal",
  analyticsId: "newsletter",
  basePath: "/newsletter",
  visibility: { kind: "permission", action: "apps.newsletter.access" },
  description:
    "Write, preview, schedule and measure the START Berlin newsletter.",
  nav: {
    items: [
      { label: "Issues", href: "/newsletter" },
      { label: "Audience", href: "/newsletter/audience" },
      { label: "Analytics", href: "/newsletter/analytics" },
      { label: "Settings", href: "/newsletter/settings" },
    ],
  },
};
