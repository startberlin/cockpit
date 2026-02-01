import type { Department } from "@/db/schema/auth";

export const DEPARTMENTS: Record<Department, string> = {
  partnerships: "Partnerships",
  operations: "Operations & Digital",
  community: "Community & HR",
  growth: "Growth",
  events: "Events",
};
