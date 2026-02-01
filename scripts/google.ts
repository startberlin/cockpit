import { google } from "googleapis";
import { createGoogleAuth } from "@/lib/google-auth";

async function main() {
  try {
    const auth = createGoogleAuth(
      "https://www.googleapis.com/auth/admin.directory.group.member",
    );

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
