import type { ComponentType } from "react";
import type { User } from "@/db/schema/auth";
import { StepAddress } from "./step-address";
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
  ADDRESS: "address",
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
    title: "Welcome to START Berlin",
    description:
      "Let's finish the details START needs for your membership. This only takes a few minutes.",
  },
  [ONBOARDING_STEPS.MASTER_DATA]: {
    component: StepMasterData,
    title: "Your contact details",
    description:
      "Add the email address and phone number START Berlin can use to reach you.",
  },
  [ONBOARDING_STEPS.ADDRESS]: {
    component: StepAddress,
    title: "Your address",
    description:
      "Add your current address so START Berlin can keep its membership records up to date.",
  },
};

export const ALL_STEPS = [
  ONBOARDING_STEPS.WELCOME,
  ONBOARDING_STEPS.MASTER_DATA,
  ONBOARDING_STEPS.ADDRESS,
];
