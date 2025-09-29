import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Cockpit",
  description: "Manage your membership, get access to software and more.",
});

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/auth");
  }

  return <p>Welcome to the START Cockpit</p>;
}
