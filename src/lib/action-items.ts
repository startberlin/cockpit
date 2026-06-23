// Open "action items" a member still needs to complete. These mirror the
// member-facing reminders (welcome / sign-in, membership application,
// reconfirmation, payment mandate) so that admins can chase the same people
// the system already nudges via email.

export const ACTION_ITEM_TYPES = [
  "first_login",
  "complete_onboarding",
  "submit_application",
  "reconfirm_membership",
  "set_up_mandate",
] as const;

export type ActionItemType = (typeof ACTION_ITEM_TYPES)[number];

export const ACTION_ITEM_INFO: Record<
  ActionItemType,
  { label: string; description: string }
> = {
  first_login: {
    label: "Sign-in pending",
    description: "Has been invited but has never signed in to the Cockpit.",
  },
  complete_onboarding: {
    label: "Onboarding incomplete",
    description:
      "Has signed in but hasn't completed the initial onboarding (profile details).",
  },
  submit_application: {
    label: "Application pending",
    description: "Still needs to submit their membership application.",
  },
  reconfirm_membership: {
    label: "Reconfirmation pending",
    description: "Still needs to reconfirm their membership.",
  },
  set_up_mandate: {
    label: "Payment mandate pending",
    description:
      "Needs to set up a payment mandate (or set one up again after the previous one expired).",
  },
};

const ACTION_ITEM_TYPE_SET = new Set<string>(ACTION_ITEM_TYPES);

export function isActionItemType(value: string): value is ActionItemType {
  return ACTION_ITEM_TYPE_SET.has(value);
}

export function parseActionItemTypes(
  raw: string | undefined | null,
): ActionItemType[] | undefined {
  if (!raw) return undefined;
  const parsed = raw.split(",").filter(isActionItemType);
  return parsed.length > 0 ? parsed : undefined;
}
