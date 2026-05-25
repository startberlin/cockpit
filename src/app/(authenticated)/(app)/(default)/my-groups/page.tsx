import db from "@/db";
import { listManualGroupsForUser } from "@/db/groups";
import { getCurrentUser } from "@/db/user";
import { getSystemGroupsForUser } from "@/lib/groups/system-groups";
import { createMetadata } from "@/lib/metadata";
import MyGroupsClient from "./page-client";

export const metadata = createMetadata({
  title: "My Groups",
  description: "Groups you belong to.",
});

export default async function MyGroupsPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;

  const [userRecord, positions, batches, manualGroups] = await Promise.all([
    db.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, currentUser.id),
      columns: { status: true, department: true, batchNumber: true },
      with: { accessGrants: { columns: { grant: true } } },
    }),
    db.query.userOrganizationPosition.findMany({
      where: (p, { eq }) => eq(p.userId, currentUser.id),
      columns: { position: true, scope: true, department: true },
    }),
    db.query.batch.findMany({ columns: { number: true } }),
    listManualGroupsForUser(currentUser.id),
  ]);

  const systemGroups = userRecord
    ? getSystemGroupsForUser(
        {
          id: currentUser.id,
          status: userRecord.status,
          department: userRecord.department,
          batchNumber: userRecord.batchNumber,
          grants: userRecord.accessGrants.map((g) => g.grant),
        },
        positions,
        batches,
      )
    : [];

  return (
    <MyGroupsClient systemGroups={systemGroups} manualGroups={manualGroups} />
  );
}
