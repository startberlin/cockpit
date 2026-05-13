import { redirect } from "next/navigation";
import {
  getActiveLegalMembership,
  getMemberSinceDate,
  requiresMembershipBilling,
} from "@/db/membership";
import { getActivePaymentTerm } from "@/db/membership-payments";
import { getDepartmentHeadForDepartment } from "@/db/people";
import { getCurrentUser } from "@/db/user";
import { getStructuredMembershipState } from "@/lib/membership-status";
import { createMetadata } from "@/lib/metadata";
import { MembershipPageContent } from "./onboarding";

export const metadata = createMetadata({
  title: "Cockpit",
  description: "View your START Berlin membership status and tools.",
});

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth");
  }

  const showBillingInfo = requiresMembershipBilling(user.status);

  const [activeLegalMembership, memberSinceDate, paymentTerm, departmentHead] =
    await Promise.all([
      getActiveLegalMembership(user.id),
      getMemberSinceDate(user.id),
      showBillingInfo ? getActivePaymentTerm(user.id) : Promise.resolve(null),
      user.department
        ? getDepartmentHeadForDepartment(user.department)
        : Promise.resolve(null),
    ]);

  const membershipState = getStructuredMembershipState(user);

  return (
    <MembershipPageContent
      membershipState={membershipState}
      userStatus={user.status}
      firstName={user.firstName}
      activeLegalMembership={activeLegalMembership}
      contactDetails={{
        email: user.email,
        personalEmail: user.personalEmail,
        phone: user.phone,
        street: user.street,
        city: user.city,
        state: user.state,
        zip: user.zip,
        country: user.country,
      }}
      membershipDetails={{
        memberSince: memberSinceDate,
        batchNumber: user.batchNumber,
        department: user.department ?? null,
        departmentHead,
        paymentTerm,
        showBillingInfo,
      }}
    />
  );
}
