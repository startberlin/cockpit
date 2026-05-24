import "server-only";

import db from "@/db";
import {
  addGroupMember,
  createGoogleGroup,
} from "@/lib/google-workspace/directory";
import {
  getMembersOfSystemGroup,
  getSystemGroupBySlug,
} from "@/lib/groups/system-groups";
import { events, inngest } from "@/lib/inngest";

export const bootstrapBatchSystemGroupWorkflow = inngest.createFunction(
  {
    id: "bootstrap-batch-system-group",
    idempotency: "event.data.batchNumber",
    triggers: [{ event: events.batchCreated }],
  },
  async ({ event, step }) => {
    const { batchNumber } = event.data;
    const slug = `batch-${batchNumber}`;
    const groupEmail =
      getSystemGroupBySlug(slug)?.googleGroupEmail ??
      `${slug}@start-berlin.com`;

    await step.run("create-google-group", () =>
      createGoogleGroup(slug, `Batch ${batchNumber}`),
    );

    const members = await step.run("load-members", async () => {
      const users = await db.query.user.findMany({
        columns: {
          id: true,
          status: true,
          department: true,
          batchNumber: true,
          email: true,
        },
      });
      const memberWithEmail: { id: string; email: string }[] = [];
      for (const u of getMembersOfSystemGroup(slug, users, [])) {
        if (u.email) memberWithEmail.push({ id: u.id, email: u.email });
      }
      return memberWithEmail;
    });

    for (const member of members) {
      await step.run(`add-member-${member.id}`, () =>
        addGroupMember(groupEmail, member.email),
      );
    }

    return { groupEmail, memberCount: members.length };
  },
);
