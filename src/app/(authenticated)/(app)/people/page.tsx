import { PeopleTable } from "@/components/people-table";
import { getAllUsersWithDetails } from "@/db/people";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Cockpit",
  description: "Manage your membership, get access to software and more.",
});

export default async function Home() {
  const users = await getAllUsersWithDetails();

  if (!users.data) {
    return <p>No users found</p>;
  }

  return <PeopleTable data={users.data} />;
}
