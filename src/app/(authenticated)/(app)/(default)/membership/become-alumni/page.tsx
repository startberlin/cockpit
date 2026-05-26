import { redirect } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { getActiveMembershipTransitionRequest } from "@/db/membership-transitions";
import { getCurrentUser } from "@/db/user";
import { StepChoose } from "./[step]/(steps)/index";

export default async function BecomeAlumniPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth");

  const isEligible =
    user.status === "member" || user.status === "supporting_alumni";

  if (!isEligible) redirect("/membership");

  const pendingTransition = await getActiveMembershipTransitionRequest(user.id);
  if (pendingTransition) redirect("/membership");

  // Supporting alumni can only transition to alumni, so skip the choice.
  if (user.status === "supporting_alumni") {
    redirect("/membership/become-alumni/alumni-confirm");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="rounded-md px-[6px] py-[2px] bg-muted">
              <BreadcrumbPage className="flex items-center gap-1 font-regular">
                Choose alumni status
              </BreadcrumbPage>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="flex items-center gap-1 font-regular text-muted-foreground">
                ...
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Choose your next chapter
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select how you'd like to continue your relationship with START
            Berlin.
          </p>
        </div>
      </div>
      <StepChoose />
    </div>
  );
}
