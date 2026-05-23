export const DEPARTMENT_IDS = [
  "partnerships",
  "operations",
  "people",
  "growth",
  "events",
] as const;

export const DEPARTMENT_NAMES = {
  partnerships: "Partnerships",
  operations: "Operations & Digital",
  people: "People",
  growth: "Growth",
  events: "Events",
} as const satisfies Record<(typeof DEPARTMENT_IDS)[number], string>;
