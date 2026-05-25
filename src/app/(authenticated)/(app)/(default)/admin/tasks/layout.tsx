import { redirect } from "next/navigation";
import { can } from "@/lib/permissions/server";

export default async function AdminTasksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [canViewAdmission, canViewTransitions, canViewCancellations] =
    await Promise.all([
      can("membership.resolution.admission.view"),
      can("membership.transition.view"),
      can("membership.cancellation.view"),
    ]);

  if (!canViewAdmission && !canViewTransitions && !canViewCancellations) {
    redirect("/membership");
  }

  return <>{children}</>;
}
