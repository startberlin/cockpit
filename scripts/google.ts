import { GoogleAuth } from "google-auth-library";
import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/admin.directory.group.member"];

// The Workspace user to impersonate (has Groups Admin or equivalent role)
const SUBJECT = "digital-connection-management@start-berlin.com";

async function main() {
  try {
    console.log("Env vars", process.env.GOOGLE_CLIENT_ID);

    const auth = new GoogleAuth({
      scopes: SCOPES,
      clientOptions: { subject: SUBJECT },
    });

    const admin = google.admin({
      auth,
      version: "directory_v1",
    });

    // Example: add a member
    await admin.members.insert({
      groupKey: "cockpit@start-berlin.com", // group email or ID
      requestBody: {
        email: "jan-vincent.hoffbauer@start-berlin.com",
        role: "MEMBER",
      },
    });

    console.log("Successfully added member to group");
  } catch (error) {
    console.error("Error managing Google Groups:", error);
    process.exit(1);
  }
}

// Run the script
main();
