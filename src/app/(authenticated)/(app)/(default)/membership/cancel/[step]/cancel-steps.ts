export const CANCEL_STEP_KEYS = ["confirm", "details"] as const;

export type CancelStep = (typeof CANCEL_STEP_KEYS)[number];

export const CANCEL_STEP_META: Record<
  CancelStep,
  { label: string; title: string; subtitle: string }
> = {
  confirm: {
    label: "Confirm",
    title: "Cancel your membership",
    subtitle: "Please read the following carefully before proceeding.",
  },
  details: {
    label: "Details",
    title: "Confirm cancellation",
    subtitle: "We're sad to see you go!",
  },
};

export function isCancelStep(step: string): step is CancelStep {
  return CANCEL_STEP_KEYS.includes(step as CancelStep);
}

export function getStepIndex(step: CancelStep): number {
  return CANCEL_STEP_KEYS.indexOf(step);
}
