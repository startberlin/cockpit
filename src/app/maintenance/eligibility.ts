import "server-only";

import { getUserAuthority } from "@/db/authority";
import { isActiveAuthorityStatus } from "@/lib/authority/model";

export async function isMaintenanceAdmin(userId: string): Promise<boolean> {
  const authority = await getUserAuthority(userId);
  return (
    !!authority &&
    isActiveAuthorityStatus(authority.status) &&
    authority.grants.some(({ grant }) => grant === "admin")
  );
}
