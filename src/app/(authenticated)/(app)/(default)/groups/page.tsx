import db from "@/db";
import { listGroupsForViewer } from "@/db/groups";
import { getCurrentUser } from "@/db/user";
import {
  getAllSystemGroups,
  getSystemGroupsForUser,
} from "@/lib/groups/system-groups";
import { createMetadata } from "@/lib/metadata";
import GroupsClient from "./page-client";

export const metadata = createMetadata({
  title: "Groups",
  description: "All START Berlin groups.",
});

export default async function GroupsPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;

  const [userRecord, positions, batches, manualGroupsResult] =
    await Promise.all([
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
      listGroupsForViewer(currentUser.id),
    ]);

  const userSystemGroupSlugs = new Set(
    userRecord
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
        ).map((g) => g.slug)
      : [],
  );

  const allSystemGroups = getAllSystemGroups(batches);

  return (
    <GroupsClient
      systemGroups={allSystemGroups.map((sg) => ({
        slug: sg.slug,
        name: sg.name,
        email: sg.googleGroupEmail,
        isMember: userSystemGroupSlugs.has(sg.slug),
      }))}
      manualGroups={manualGroupsResult.groups}
    />
  );
}
