export const DEPARTMENT_IDS = [
  "partnerships",
  "operations",
  "community",
  "growth",
  "events",
] as const;

export const DEPARTMENT_NAMES = {
  partnerships: "Partnerships",
  operations: "Operations & Digital",
  community: "People",
  growth: "Growth",
  events: "Events",
} as const satisfies Record<(typeof DEPARTMENT_IDS)[number], string>;
