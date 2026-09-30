import type { ExternalAppDefinition } from "./types";
import { externalToolVisibility } from "./visibility";

/**
 * The external SaaS workspaces members get access to.
 *
 * Visibility is a *status* check, never a permission: onboarding members have no
 * authority at all (see `evaluateAuth`) but must still be able to join these.
 *
 * `analyticsId` values are the historic `data-ph-capture-attribute-service`
 * slugs — existing PostHog insights key off them, so do not rename. Apps with a
 * `dialog` launcher set the attribute inside their own dialog component.
 */
export const externalApps = [
  {
    kind: "external",
    id: "slack",
    name: "Slack",
    category: "communication",
    analyticsId: "slack",
    visibility: externalToolVisibility,
    launcher: { type: "dialog" },
    description: ({ actionLabel }) =>
      `${actionLabel} Slack to coordinate with the START Berlin team day-to-day.`,
  },
  {
    kind: "external",
    id: "gmail",
    name: "Gmail",
    category: "communication",
    analyticsId: "gmail",
    visibility: externalToolVisibility,
    launcher: { type: "link", href: "https://mail.google.com" },
    description: ({ actionLabel }) =>
      `${actionLabel} Gmail to send and receive emails for START Berlin.`,
  },
  {
    kind: "external",
    id: "google-meet",
    name: "Google Meet",
    category: "communication",
    analyticsId: "google-meet",
    visibility: externalToolVisibility,
    launcher: { type: "link", href: "https://meet.google.com" },
    description: ({ actionLabel }) =>
      `${actionLabel} Google Meet to start or attend online video calls.`,
  },
  {
    kind: "external",
    id: "notion",
    name: "Notion",
    category: "collaboration",
    analyticsId: "notion",
    visibility: externalToolVisibility,
    launcher: { type: "dialog" },
    description: ({ actionLabel }) =>
      `${actionLabel} Notion to access START Berlin's shared docs and project resources.`,
  },
  {
    kind: "external",
    id: "google-drive",
    name: "Google Drive",
    category: "collaboration",
    analyticsId: "google-drive",
    visibility: externalToolVisibility,
    launcher: { type: "link", href: "https://drive.google.com" },
    description: ({ actionLabel }) =>
      `${actionLabel} Google Drive to access and collaborate on files shared across START Berlin.`,
  },
  {
    kind: "external",
    id: "tally",
    name: "Tally",
    category: "collaboration",
    analyticsId: "tally",
    visibility: externalToolVisibility,
    launcher: { type: "dialog" },
    description: ({ actionLabel }) =>
      `${actionLabel} Tally to create and manage forms and surveys.`,
  },
  {
    kind: "external",
    id: "canva",
    name: "Canva",
    category: "collaboration",
    analyticsId: "canva",
    visibility: externalToolVisibility,
    launcher: { type: "dialog" },
    description: ({ actionLabel }) =>
      `${actionLabel} Canva to design social media posts, slide decks, and presentations for START Berlin.`,
  },
  {
    kind: "external",
    id: "bubbles",
    name: "Bubbles",
    category: "productivity",
    analyticsId: "bubbles",
    visibility: externalToolVisibility,
    launcher: { type: "dialog" },
    description: ({ actionLabel }) =>
      `${actionLabel} Bubbles to record, transcribe, and summarise meetings and share async video clips with the team.`,
  },
] as const satisfies readonly ExternalAppDefinition[];
