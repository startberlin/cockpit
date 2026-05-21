import db from "@/db";
import {
  getWorkspaceUser,
  updateWorkspaceUserName,
} from "@/lib/google-workspace/directory";
import { events, inngest } from "@/lib/inngest";
import { getWorkspaceNameUpdate } from "./sync-google-workspace-user-name-helper";

export const syncGoogleWorkspaceUserNameWorkflow = inngest.createFunction(
  {
    id: "sync-google-workspace-user-name",
    triggers: [{ event: events.cockpitUserUpdated }],
    concurrency: {
      key: "event.data.id",
      limit: 1,
    },
  },
  async ({ event, step }) => {
    const localUser = await step.run("load-db-user", async () => {
      return await db.query.user.findFirst({
        where: (users, { eq }) => eq(users.id, event.data.id),
        columns: {
          email: true,
          firstName: true,
          lastName: true,
        },
      });
    });

    if (!localUser) {
      return { status: "local-user-not-found" };
    }

    if (!localUser.email) {
      return { status: "email-erased" };
    }

    const email = localUser.email;

    const workspaceUser = await step.run("load-workspace-user", async () => {
      return await getWorkspaceUser(email);
    });

    if (!workspaceUser) {
      return { status: "workspace-user-not-found" };
    }

    const nameUpdate = getWorkspaceNameUpdate(localUser, workspaceUser);

    if (!nameUpdate) {
      return { status: "workspace-name-current" };
    }

    await step.run("update-workspace-name", async () => {
      await updateWorkspaceUserName(email, nameUpdate);
    });

    return { status: "workspace-name-updated" };
  },
);
