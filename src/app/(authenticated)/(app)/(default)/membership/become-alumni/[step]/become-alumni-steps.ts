export const BECOME_ALUMNI_STEP_KEYS = [
  "supporting-alumni",
  "alumni-confirm",
  "alumni-community",
  "alumni-finalize",
] as const;

export type BecomeAlumniStep = (typeof BECOME_ALUMNI_STEP_KEYS)[number];

export type BecomeAlumniDisplayStep = "choose" | BecomeAlumniStep;

export const BECOME_ALUMNI_STEP_META: Record<
  BecomeAlumniDisplayStep,
  { label: string; title: string; subtitle: string }
> = {
  choose: {
    label: "Choose alumni status",
    title: "Choose your next chapter",
    subtitle:
      "Select how you'd like to continue your relationship with START Berlin.",
  },
  "supporting-alumni": {
    label: "Supporting Alumni",
    title: "Become a Supporting Alumni",
    subtitle: "We're happy you're staying!",
  },
  "alumni-confirm": {
    label: "What changes",
    title: "Leave START Berlin e.V.",
    subtitle: "Please read the following carefully before proceeding.",
  },
  "alumni-community": {
    label: "Alumni community",
    title: "Join the alumni community",
    subtitle:
      "Stay connected in our alumni community after your account is closed.",
  },
  "alumni-finalize": {
    label: "Confirm",
    title: "Cancel START Berlin e.V. membership",
    subtitle: "End your membership, leave START Berlin and become an alumni.",
  },
};

export function isBecomeAlumniStep(step: string): step is BecomeAlumniStep {
  return BECOME_ALUMNI_STEP_KEYS.includes(step as BecomeAlumniStep);
}

export function getBreadcrumbSteps(
  currentStep: BecomeAlumniStep,
): BecomeAlumniDisplayStep[] {
  if (currentStep === "supporting-alumni")
    return ["choose", "supporting-alumni"];
  return ["choose", "alumni-confirm", "alumni-community", "alumni-finalize"];
}
