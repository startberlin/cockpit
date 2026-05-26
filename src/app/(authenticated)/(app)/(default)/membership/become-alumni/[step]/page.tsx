import { notFound, redirect } from "next/navigation";
import { getActiveMembershipTransitionRequest } from "@/db/membership-transitions";
import { getCurrentUser } from "@/db/user";
import {
  StepAlumniCommunity,
  StepAlumniConfirm,
  StepAlumniFinalize,
  StepSupportingAlumni,
} from "./(steps)/index";

export default async function BecomeAlumniStepPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth");

  const isEligible =
    user.status === "member" || user.status === "supporting_alumni";

  if (!isEligible) redirect("/membership");

  // Already has a pending board-review request: nothing more to do here.
  const pendingTransition = await getActiveMembershipTransitionRequest(user.id);
  if (pendingTransition) redirect("/membership");

  const { step } = await params;

  if (step === "supporting-alumni") {
    if (user.status === "supporting_alumni")
      redirect("/membership/become-alumni/alumni-confirm");

    return <StepSupportingAlumni />;
  }

  const isSupportingAlumni = user.status === "supporting_alumni";

  if (step === "alumni-confirm") {
    return (
      <StepAlumniConfirm
        companyEmail={user.email ?? ""}
        isSupportingAlumni={isSupportingAlumni}
      />
    );
  }

  if (step === "alumni-community") {
    return <StepAlumniCommunity currentPersonalEmail={user.personalEmail} />;
  }

  if (step === "alumni-finalize") {
    return (
      <StepAlumniFinalize
        currentPersonalEmail={user.personalEmail}
        companyEmail={user.email ?? ""}
        isSupportingAlumni={isSupportingAlumni}
      />
    );
  }

  notFound();
}
