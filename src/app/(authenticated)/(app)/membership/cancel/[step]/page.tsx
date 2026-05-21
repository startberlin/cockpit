import { notFound, redirect } from "next/navigation";
import { getActiveLegalMembership } from "@/db/membership";
import { getActiveMembershipTransitionRequest } from "@/db/membership-transitions";
import { getCurrentUser } from "@/db/user";
import { can } from "@/lib/permissions/server";
import { StepConfirm, StepDetails } from "./(steps)/index";

export default async function CancelStepPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth");

  if (!(await can("membership.cancel_own", { id: user.id }))) {
    redirect("/membership");
  }

  const pendingTransition = await getActiveMembershipTransitionRequest(user.id);
  if (pendingTransition) redirect("/membership");

  const activeLegalMembership = await getActiveLegalMembership(user.id);
  if (!activeLegalMembership || activeLegalMembership.status !== "active") {
    redirect("/membership");
  }

  const { step } = await params;
  const companyEmail = user.email ?? "";

  if (step === "confirm") {
    return <StepConfirm companyEmail={companyEmail} />;
  }

  if (step === "details") {
    return (
      <StepDetails
        currentPersonalEmail={user.personalEmail}
        companyEmail={companyEmail}
      />
    );
  }

  notFound();
}
