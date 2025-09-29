import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Cockpit",
  description: "Manage your membership, get access to software and more.",
});

export default async function Home() {
  return <p>Welcome to the START Cockpit</p>;
}
