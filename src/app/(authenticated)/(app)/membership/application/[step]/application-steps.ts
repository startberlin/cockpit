export const APPLICATION_STEP_KEYS = [
  "personal-information",
  "identity",
  "bylaws",
  "fees",
  "review",
] as const;

export type ApplicationStep = (typeof APPLICATION_STEP_KEYS)[number];

export const APPLICATION_STEP_META: Record<
  ApplicationStep,
  { label: string; title: string; subtitle: string }
> = {
  "personal-information": {
    label: "Personal Information",
    title: "Your Personal Information",
    subtitle:
      "We need a few details to complete your membership application. Your address is only shared with people who need it for administration.",
  },
  identity: {
    label: "Identity",
    title: "Confirm Your Identity",
    subtitle:
      "To become a member of START Berlin e.V., you must be a natural person with full legal capacity.",
  },
  bylaws: {
    label: "Bylaws",
    title: "Purpose & Bylaws",
    subtitle:
      "Read the Satzung and confirm that you support the purpose of START Berlin e.V. and accept its bylaws.",
  },
  fees: {
    label: "Membership Fee",
    title: "Membership Fee",
    subtitle:
      "Read the Finanzordnung and confirm that you understand and accept the yearly membership fee.",
  },
  review: {
    label: "Review",
    title: "Review & Submit",
    subtitle: "Check your details and submit your membership application.",
  },
};

export function isApplicationStep(step: string): step is ApplicationStep {
  return APPLICATION_STEP_KEYS.includes(step as ApplicationStep);
}

export function getStepIndex(step: ApplicationStep): number {
  return APPLICATION_STEP_KEYS.indexOf(step);
}
