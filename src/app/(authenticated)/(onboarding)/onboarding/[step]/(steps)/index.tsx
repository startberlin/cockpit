import type { ComponentType } from "react";
import type { User } from "@/db/schema/auth";
import { StepMasterData } from "./step-master-data";
import { StepWelcome } from "./step-welcome";

// Shared interface for all step components
export interface StepComponentProps {
  user: User;
}

// Central definition of all onboarding steps
export const ONBOARDING_STEPS = {
  WELCOME: "welcome",
  MASTER_DATA: "my-profile",
} as const;

export type OnboardingStep =
  (typeof ONBOARDING_STEPS)[keyof typeof ONBOARDING_STEPS];

interface StepDefinition {
  component: ComponentType<StepComponentProps>;
  title: string;
  description: string;
}

// Unified map for step details
export const STEP_DEFINITIONS: Record<OnboardingStep, StepDefinition> = {
  [ONBOARDING_STEPS.WELCOME]: {
    component: StepWelcome,
    title: "Welcome to START Cockpit",
    description:
      "START Cockpit is the member portal of START Berlin. You can use it to manage your membership, see who else is a member and get access to our tools.",
  },
  [ONBOARDING_STEPS.MASTER_DATA]: {
    component: StepMasterData,
    title: "Your contact details",
    description:
      "Add the email address, phone number, and date of birth START Berlin needs to reach you.",
  },
};

export const ALL_STEPS = [
  ONBOARDING_STEPS.WELCOME,
  ONBOARDING_STEPS.MASTER_DATA,
];
