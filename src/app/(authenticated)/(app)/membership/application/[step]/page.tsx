import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import db from "@/db";
import { getActiveLegalMembership } from "@/db/membership";
import { membershipApplication } from "@/db/schema/membership-application";
import { getCurrentUser } from "@/db/user";
import {
  StepBylaws,
  StepFees,
  StepIdentity,
  StepPersonalInformation,
  StepReview,
} from "./(steps)/index";

export default async function ApplicationStepPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth");
  }

  const activeLegalMembership = await getActiveLegalMembership(user.id);

  if (
    !activeLegalMembership ||
    (activeLegalMembership.status !== "application_pending" &&
      activeLegalMembership.status !== "membership_reconfirmation_pending")
  ) {
    redirect("/membership");
  }

  const legalMembershipId = activeLegalMembership.id;
  const isReconfirmation =
    activeLegalMembership.status === "membership_reconfirmation_pending";

  const { step } = await params;

  if (step === "personal-information") {
    return (
      <StepPersonalInformation
        user={user}
        legalMembershipId={legalMembershipId}
        isReconfirmation={isReconfirmation}
      />
    );
  }

  if (step === "identity" || step === "bylaws" || step === "fees") {
    const draft = await db.query.membershipApplication.findFirst({
      where: eq(membershipApplication.legalMembershipId, legalMembershipId),
    });

    if (step === "identity") {
      return (
        <StepIdentity
          legalMembershipId={legalMembershipId}
          declarations={draft?.declarations}
        />
      );
    }

    if (step === "bylaws") {
      return (
        <StepBylaws
          legalMembershipId={legalMembershipId}
          declarations={draft?.declarations}
        />
      );
    }

    return (
      <StepFees
        legalMembershipId={legalMembershipId}
        declarations={draft?.declarations}
      />
    );
  }

  // Legacy redirects
  if (step === "address" || step === "declarations") {
    redirect("/membership/application/personal-information");
  }

  if (step === "review") {
    const draft = await db.query.membershipApplication.findFirst({
      where: eq(membershipApplication.legalMembershipId, legalMembershipId),
    });

    const hasPersonalInfo =
      !!draft?.street &&
      !!draft?.city &&
      !!draft?.zip &&
      !!draft?.country &&
      !!draft?.birthDate;

    if (!hasPersonalInfo) {
      redirect("/membership/application/personal-information");
    }

    const decl = draft?.declarations;
    if (!decl?.naturalPerson || !decl?.legalCapacity) {
      redirect("/membership/application/identity");
    } else if (!decl?.supportsPurpose || !decl?.acceptsBylaws) {
      redirect("/membership/application/bylaws");
    } else if (!decl?.acceptsFinancialRegulations || !decl?.acknowledgesFee) {
      redirect("/membership/application/fees");
    }

    return (
      <StepReview
        user={user}
        legalMembershipId={legalMembershipId}
        draft={draft}
        isReconfirmation={isReconfirmation}
      />
    );
  }

  redirect("/membership/application/personal-information");
}
