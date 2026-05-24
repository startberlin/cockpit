import "server-only";

import db from "@/db";
import { DEPARTMENT_IDS } from "@/lib/departments";
import {
  addGroupMember,
  listGroupMemberEmails,
  removeGroupMember,
} from "@/lib/google-workspace/directory";
import { events, inngest } from "@/lib/inngest";

const DOMAIN = "start-berlin.com";

async function syncGroupMembership(
  groupEmail: string,
  shouldBeMember: boolean,
  userEmail: string,
): Promise<void> {
  const currentMembers = await listGroupMemberEmails(groupEmail);
  const isCurrentMember = currentMembers.includes(userEmail.toLowerCase());
  if (shouldBeMember && !isCurrentMember) {
    await addGroupMember(groupEmail, userEmail);
  } else if (!shouldBeMember && isCurrentMember) {
    await removeGroupMember(groupEmail, userEmail);
  }
}

export const syncPositionSystemGroupsWorkflow = inngest.createFunction(
  {
    id: "sync-position-system-groups",
    triggers: [{ event: events.positionsSystemGroupsSync }],
    concurrency: {
      key: "event.data.userId",
      limit: 1,
    },
  },
  async ({ event, step }) => {
    const { userId } = event.data;

    const { positions, email } = await step.run("load-positions", async () => {
      const [positionRows, userRecord] = await Promise.all([
        db.query.userOrganizationPosition.findMany({
          where: (p, { eq }) => eq(p.userId, userId),
          columns: { position: true, scope: true, department: true },
        }),
        db.query.user.findFirst({
          where: (u, { eq }) => eq(u.id, userId),
          columns: { email: true },
        }),
      ]);
      return { positions: positionRows, email: userRecord?.email ?? null };
    });

    if (!email) return { skipped: true };

    await step.run("sync-google-board@", () =>
      syncGroupMembership(`board@${DOMAIN}`, positions.length > 0, email),
    );

    await step.run("sync-google-legal-board@", () =>
      syncGroupMembership(
        `legal-board@${DOMAIN}`,
        positions.some(
          (p) =>
            p.position === "president" ||
            p.position === "vice_president" ||
            p.position === "head_of_finance",
        ),
        email,
      ),
    );

    for (const dept of DEPARTMENT_IDS) {
      await step.run(`sync-google-${dept}@`, () =>
        syncGroupMembership(
          `${dept}@${DOMAIN}`,
          positions.some(
            (p) => p.position === "department_head" && p.department === dept,
          ),
          email,
        ),
      );
    }

    return { synced: true };
  },
);
