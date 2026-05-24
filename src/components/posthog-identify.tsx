import { getCurrentUser } from "@/db/user";
import { PostHogIdentifyClient } from "./posthog-identify-client";

export async function PostHogIdentify() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <PostHogIdentifyClient
      id={user.id}
      email={user.email ?? ""}
      name={user.name}
      status={user.status}
      department={user.department ?? null}
      batchNumber={user.batchNumber ?? null}
      legalMembershipState={user.legalMembershipState}
      eventEmailPreference={user.eventEmailPreference ?? null}
      memberSinceDate={user.memberSinceDate ?? null}
    />
  );
}
