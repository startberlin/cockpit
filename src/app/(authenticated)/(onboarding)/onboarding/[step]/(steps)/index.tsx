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
    title: "Welcome to START Cockpit",
    description:
      "START Cockpit is your central platform to manage your membership, access software and more. Get started by setting up your account.",
  },
  [ONBOARDING_STEPS.MASTER_DATA]: {
    component: StepMasterData,
    title: "Set up your account",
    description:
      "We need to know how to contact you for your START Berlin membership. You can update these details later in case you change your email or phone number.",
  },
  [ONBOARDING_STEPS.ADDRESS]: {
    component: StepAddress,
    title: "Your address",
    description:
      "Provide your current address so we can keep our records up to date.",
  },
};

export const ALL_STEPS = [
  ONBOARDING_STEPS.WELCOME,
  ONBOARDING_STEPS.MASTER_DATA,
  ONBOARDING_STEPS.ADDRESS,
];
