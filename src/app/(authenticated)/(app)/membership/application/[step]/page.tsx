import { redirect } from "next/navigation";
import { getActiveLegalMembership } from "@/db/membership";
import { getCurrentUser } from "@/db/user";
import { StepAddress, StepDeclarations, StepReview } from "./(steps)/index";

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
    activeLegalMembership.status !== "application_pending"
  ) {
    redirect("/membership");
  }

  const { step } = await params;

  if (step === "address") {
    return (
      <StepAddress user={user} legalMembershipId={activeLegalMembership.id} />
    );
  }

  if (step === "declarations") {
    return <StepDeclarations legalMembershipId={activeLegalMembership.id} />;
  }

  if (step === "review") {
    return (
      <StepReview user={user} legalMembershipId={activeLegalMembership.id} />
    );
  }

  redirect("/membership/application/address");
}
